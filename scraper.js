(function() {
	var appKey;

	var tables; 

	var getAppKey = function(key) {
		appKey = key;
		tables = document.getElementsByClassName('summaryTable');
		//pick the last table
		if (tables.length > 0) {
			process(tables[tables.length - 1]);
		}
	}

	var process = function(table) {
		var data = [];

		for (var i = 0; i < table.rows.length; i++) {
			var row = table.rows[i];
			var cols = row.getElementsByTagName('td');
			var vals = [];

			for (var j = 0; j < cols.length; j++) {
				vals.push(cols[j].innerText);	
			}

			data.push(vals);
		}

		appKey && chrome.runtime.sendMessage(appKey, data);	
		
	}

	chrome.runtime.onMessage.addListener(getAppKey);
	
})();
