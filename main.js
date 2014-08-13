var monthNames = [ "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December" ];

var getTemplate = function(path, callback) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function(data) {
		if (data.target.readyState === 4) {
			callback(data.target.responseText);
		}
	};
	xhr.open("GET", chrome.extension.getURL(path), true);
	xhr.send();
}

var transactionsToQIF  = function(path, data, callback) {
	getTemplate(path, function(template) {
		var qif = Mustache.to_html(template, {transactions: data});
		callback(qif);
	});
}

var toQIFDate = function(date) {
	return (
		('0' + date.getDate()).slice(-2) + '/' +
	  ('0' + (date.getMonth()+1)).slice(-2) + '/' +
    date.getFullYear()
	);
}

var parseSmileDate = function(data) {
	var date = data.split("/");
	date = new Date(parseInt(date[2]), parseInt(date[1]) - 1, parseInt(date[0]));
	return date;
	
}

var parseAmount = function(data) {

	var amount;
	var tmp = data.substr(data.indexOf('£') + 1); 

	//if it has a trailing polarity
	//reverse it.
	//a positive on your credit card statement in smile is a DEBIT
	//a negative is a PAYMENT 
	if (tmp.indexOf('+') === tmp.length - 1 || tmp.indexOf('-') === tmp.length - 1) {
		amount = parseFloat(tmp.substr(0, tmp.length - 1));
		if (tmp[tmp.length - 1] === '+') {
			amount *= -1;
		}	
	} else {
		amount = parseFloat(tmp);
	}

	return amount;
}

var parseTransactions = function(data) {
	var transactions = _.chain(data)
	.filter(function(row) {
		//on smile bank and visa account pages there are at least 3 columns
		//some international transactions run to two rows, and have a blank date 
		if (row.length >= 3 && row[1] !== "BROUGHT FORWARD" && row[0].trim().length > 0) {
			return true;
		}
		return false;
	}).map(function(row) {

		var amount;

		//for account statements (4 columns)
		//credits are in the 2th column
		//debits are in the 3th column
		//either 2th or 3th column is filled
		
		//for visa statements (3 columns)
		//credits and debits in same column
		
		if (row[2].trim().length !== 0) {
			amount = parseAmount(row[2]);
		} else {
			amount = parseAmount(row[3]); 
			amount *= -1;
		}
		
		var transaction = {
			date: toQIFDate(parseSmileDate(row[0])), 
			payee: row[1].trim(),
			amount: amount.toFixed(2) 
		};

		return transaction;

	}).value();

	transactionsToQIF('js_to_qif.html', transactions, function(qifData) {
		chrome.tabs.create({
			url:"data:text/plain;charset=utf-8," + escape(qifData)
		}, function(tab) {});
	});

};

chrome.runtime.onInstalled.addListener(function() {
	chrome.declarativeContent.onPageChanged.removeRules(undefined, function() {
	  chrome.declarativeContent.onPageChanged.addRules([
			{
				conditions: [
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'balances.do'},
					}),
					new chrome.declarativeContent.PageStateMatcher({
						pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'getDomesticStatementPage.do'}
					}),
					new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'domesticRecentItems.do'}
          }),
					new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'paginateDomesticStatement.do'}
          }),
					new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'billPaymentReturnToVisaRecentItems.do'}
          }),
					new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'visaRecentItems.do'}
          }),
					new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'visaStatements.do'}
          }),
					new chrome.declarativeContent.PageStateMatcher({
            pageUrl: { hostEquals: 'banking.smile.co.uk', schemes: ['https'], pathContains: 'getVisaStatementPage.do'}
          })

				],
				actions: [ new chrome.declarativeContent.ShowPageAction() ]
			}
		]);
	});
});

chrome.runtime.onMessage.addListener(parseTransactions);

chrome.pageAction.onClicked.addListener(function(tab) {
	chrome.tabs.executeScript(tab.id, {file: "scraper.js"});
	window.setTimeout(function() {
		chrome.tabs.sendMessage(tab.id, chrome.app.getDetails().id);
	}, 500);
});

