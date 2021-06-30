const { mwn } = require('mwn');
const fetch = require('isomorphic-fetch');

const express = require('express');
const app = express();
const path = require('path');
const expressRateLimit = require('express-rate-limit');
const apicache = require('apicache');
var cache = apicache.middleware;

async function fetchEdits(user, wiki, lang = '') {
	return new Promise((resolve, reject) => {
		bot = new mwn({
			apiUrl: `https://${wiki}.fandom.com/${lang ? lang + '/' : ''}api.php`,

			// Log in for lower ratelimit and higher query size
			username: process.env.username,
			password: process.env.password,

			// Set default parameters to be sent to be included in every API request
			defaultParams: {
				format: 'json',
				// assert: 'user' // Ensure we're logged in
			},
			maxRetries: 1
		});

		bot.login().catch((e) => {
			return reject(e);
		})
		.then(async () => {
			var editDates = {};
			for await (let json of bot.continuedQueryGen({
				action: 'query',
				list: 'usercontribs',
				ucuser: user,
				uclimit: 'max',
				ucprop: 'timestamp'
			})) {
				json.query.usercontribs.forEach((contrib) => {
					let date = new Date(contrib.timestamp);
					let key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;	
					editDates[key] = isNaN(editDates[key]) ? 1 : editDates[key] + 1;
				})
			}
			resolve(editDates);
		});
	});
}

async function fetchPosts(user, wiki, lang = '') {
	return new Promise(async (resolve, reject) => {
		var postDates = {}, userId, url;
		await fetch(`https://community.fandom.com/api.php?action=query&format=json&list=users&ususers=${user}`)
			.then(async (response) => {
				json = await response.json();
				if (json.query.users[0].missing === '') throw new Error('Invalid user');
				userId = json.query.users[0].userid;
			});

		for (let i = 0; i < 1000; i++) {
			if (i === 0) {
				url = `https://${wiki}.fandom.com/${lang ? lang + '/' : ''}wikia.php?controller=DiscussionContribution&method=getPosts&limit=100&page=0&userId=${userId}`;
			} else if (!url) {
				break; // No more pages
			}
			await fetch(url)
				.then(async (response) => {
					json = await response.json();
					url = (json._links.next || [ { href: false } ])[0].href;
					json._embedded['doc:posts'].forEach((post) => {
						let date = new Date(0);
						date.setUTCSeconds(post.creationDate.epochSecond);
						let key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`;	
						postDates[key] = isNaN(postDates[key]) ? 1 : postDates[key] + 1;
					})
				});
		}
		resolve(postDates);
	});
}

const port = process.env.PORT || 80;
const rateLimit = expressRateLimit({
	windowMs: 15 * 60 * 1000, // 15 minutes
	max: 50, // Limit requests by IP per windowMs
	message: {
		'status': 'RATELIMITED',
		'message': 'Too many requests, please try again later'
	}
});

app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', rateLimit);
app.set('trust proxy', 1); // https://expressjs.com/en/guide/behind-proxies.html

app.get('/api', cache('10 minutes'), async function(req, res) {
	let user = req.query.user;
	let fullWiki = req.query.wiki;

	req.apicacheGroup = user + fullWiki;

	if (user && fullWiki) {
		if (/^([a-z]{2}\.|[a-z]{2}-[a-z]{2}\.)?[a-z0-9\-]{3,}$/mi.test(wiki)) {
			var lang, wiki;
			if (fullWiki.includes('.')) {
				[lang, wiki] = fullWiki.split(/\./);
			} else {
				wiki = fullWiki;
			}
			await Promise.allSettled([fetchEdits(user, wiki, lang), fetchPosts(user, wiki, lang)])
				.catch((e) => {
					Promise.reject(e);
				})
				.then(([edits, posts]) => {
					res.send({
						'edits': edits.value,
						'posts': posts.value
					});
				});
		} else {
			res.status(400);
			res.json({
				'status': 'ERROR',
				'message': 'Invalid wiki, only include the subdomain or lang.subdomain'
			});
		}
	} else {
		res.status(400);
		res.json({
			'status': 'ERROR',
			'message': 'Missing required parameters'
		});
	}
});

app.listen(3000, function () {
  console.log('Server running on port ' + port + '!');
});