var queryString = window.location.search;
var urlParams = new URLSearchParams(queryString);
var user = urlParams.get('user');
var wiki = urlParams.get('wiki');

if (user && wiki) {
	var spinner = document.getElementById('spinner');
	spinner.style = 'display: inherit';

	var contribs = {};
	google.charts.load('current', { 'packages': ['corechart'] });

	fetch(`/api?user=${user}&wiki=${wiki}`)
		.then(async (response) => {
			contribs = await response.json();
			contribs = contribs.result;
			spinner.style = 'display: none';
			google.charts.setOnLoadCallback(drawChart);
		})

	function drawChart() {
		var data = new google.visualization.DataTable();
		data.addColumn('date', 'Date');
		data.addColumn('number', 'Edits');

		var toDate = new Date(Object.keys(contribs)[0]);
		var fromDate = new Date(Object.keys(contribs).pop());

		for (var date = fromDate; date <= toDate; date.setDate(date.getDate() + 1)) {
			let key = `${date.getUTCFullYear()}-${date.getUTCMonth() + 1}-${date.getUTCDate()}`
			let value = contribs[key] || 0;
			data.addRow([new Date(date), value]);
		}

		var options = {
			hAxis: {
				gridlines: { color: '#333333' },
				format: 'M/d/yy',
				textStyle: {
					color: '#DDDDDD'
				}
			},
			vAxis: {
				gridlines: { color: 'none' },
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
			backgroundColor: 'transparent'
		}

		var chart = new google.visualization.LineChart(document.getElementById('chart'));
		chart.draw(data, options);
	}
}