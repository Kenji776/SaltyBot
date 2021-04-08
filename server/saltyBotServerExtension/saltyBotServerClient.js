/************* SALTYBOT SERVER COMPONENT By Kenji776 **************
Description: Javascript utility for making smarter bets on SaltyBet 
using basic historical analysis of the data and projected odds. Requires
user to be Salty illuminati and logged in. Must be run from the main page of Saltybet
by pasting the code into a javascript console (f12 in chrome)

Author: Daniel Llewellyn (Kenji776)

Date: 9/1/2013

Saltybet is run via twitch which already has jQuery and jQuery ui included
so no need to inject it ourself and since it's a bookmarklet we don't need ot wait 
for onready.
**************************************************/
var fighterSourceURL = 'http://xerointeractive.com/getFighters';
var importRequestURL = 'http://xerointeractive.com/fights/import';
document.addEventListener("DOMSubtreeModified", function ()
{
	if (event.target.id == "betstatus")
	{
		var divText= $('#'+event.target.id).text().trim().toLowerCase();
		if(divText != null)
		{
			if(divText.indexOf('bets are open') > -1)
			{
				setTimeout(function(){
					getRemoteData( fighterSourceURL, function(data){
						console.log('Fetched fighter names from webservice call');
						
						console.log(data);
					});					
				},5000);					
			}
			else if(divText.indexOf('payouts') > -1)
			{
				setTimeout(function(){
					getRemoteData( importRequestURL, function(data){
						console.log('Saving Results To Server');
						
						console.log(data);
					});					
				},10000);	
			}			
		}
	}
}, true);

getRemoteData = function(source,callback){
    var xhr = new XMLHttpRequest();
    
    xhr.open('GET', source);
    
    xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
    
    xhr.onreadystatechange = function(){
        if (xhr.readyState == 4){
            if (xhr.status == 200){
                callback(JSON.parse(xhr.responseText));
            }else{
            }
            
        }
    };
    xhr.send();
}