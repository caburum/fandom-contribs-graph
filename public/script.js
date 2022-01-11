var queryString = window.location.search;
var urlParams = new URLSearchParams(queryString);
var user = urlParams.get('user');
var wiki = urlParams.get('wiki');

if (user && wiki) {
	var spinner = document.getElementById('spinner');
	spinner.style = 'display: inherit';

	var edits = {}, posts = {};
	google.charts.load('current', { 'packages': ['corechart'] });

	fetch(`/api?user=${user}&wiki=${wiki}`)
		.then(async (response) => {
			json = await response.json();
			edits = json.edits || {};
			posts = json.posts || {};
			spinner.style = 'display: none';
			google.charts.setOnLoadCallback(drawChart);
		})

	function drawChart() {
		var data = new google.visualization.DataTable();
		data.addColumn('date', 'Date');
		data.addColumn('number', 'Edits');
		data.addColumn('number', 'Posts');

		var editsFromDate = new Date(Object.keys(edits).pop() || Date.now());
		var postsFromDate = new Date(Object.keys(posts).pop() || Date.now());

		var toDate = new Date(Date.now());
		var fromDate = editsFromDate < postsFromDate ? editsFromDate : postsFromDate;

		for (var date = fromDate; date <= toDate; date.setDate(date.getDate() + 1)) {
			let key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
			let dateEdits = edits[key] || 0;
			let datePosts = posts[key] || 0;
			data.addRow([new Date(date), dateEdits, datePosts]);
		}

		var options = {
			hAxis: {
				gridlines: {
					color: '#333333',
					count: -1
				},
				format: 'M/d/yy',
				textStyle: {
					color: '#DDDDDD'
				}
			},
			vAxis: {
				format: '#',
				gridlines: {
					color: 'none',
					count: -1
				},
				minValue: 0,
				textStyle: {
					color: '#DDDDDD'
				}
			},
			legend:{
				textStyle: {
					color: '#DDDDDD'
				}
			},
			backgroundColor: 'transparent',
			lineWidth: 1,
			focusTarget: 'category' // Show tooltip on entire category/row
		}

		var chart = new google.visualization.LineChart(document.getElementById('chart'));
		chart.draw(data, options);
	}
}