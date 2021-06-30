const { mwn } = require('mwn');

const express = require('express');
const app = express();
const path = require('path');
const expressRateLimit = require('express-rate-limit');

async function fetchContribs(user, wiki, lang = '') {
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
			reject(e);
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

app.get('/api', async function(req, res) {
	let user = req.query.user;
	let fullWiki = req.query.wiki;
	if (user && fullWiki) {
		if (/^([a-z]{2}\.|[a-z]{2}-[a-z]{2}\.)?[a-z0-9\-]{3,}$/mi.test(wiki)) {
			var lang, wiki;
			if (fullWiki.includes('.')) {
				[lang, wiki] = fullWiki.split(/\./);
			} else {
				wiki = fullWiki;
			}
			fetchContribs(user, wiki, lang).then((data) => {
				res.send({'result': data});
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
})

app.listen(3000, function () {
  console.log('Server running on port ' + port + '!');
});