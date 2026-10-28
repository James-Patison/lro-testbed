const payload = JSON.parse('{"user":{"uid":"GOS2kGM3isCbFrAW","sid":"qs3IwjmFTVjcPU85","persist":true,"exist":true},"t_client":1793173855929,"key":"c88d9119-4bed-488e-88d2-f643aa56a1e3","context":{},"limit":24,"offset":0,"slot":"motorcycles/pre-owned"}');
function getResults(py) {
    $.post("https://api.findify.io/v4/c88d9119-4bed-488e-88d2-f643aa56a1e3/smart-collection/motorcycles/pre-owned",
        py,
        function (data) {
            debugger;
        });
};
debugger;
getResults(payload);