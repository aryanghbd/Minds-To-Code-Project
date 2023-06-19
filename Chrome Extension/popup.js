/*
popup.js:
    -This is the logic that is executed during interactions with the extension's frontend.
    -Primarily consists of logic to update the statistics and metrics, such as WPM and Dimensions, by sending messages to the background script and executing content methods.
    -Submission logic to pass available data and unify it with contentScript result data for Firebase updates.
*/


let currentlyTyping = "";
let dimensions = {};
let currentWPM = 0;
let capture = {};



/*
    resetProgress():
        -Reset any metrics via manual override if necessary.
*/
function resetProgress() {
    currentlyTyping = "";
    dimensions = {};
    currentWPM = 0;
    capture = {};
    chrome.storage.local.set({'reset' : true});
    chrome.tabs.query({'active' : true, 'lastFocusedWindow' : true}, function(tabs) {
        document.getElementById("dimension").innerHTML = "Dimensions: 0x0";
        document.getElementById("wpm").innerHTML = "WPM: " + 0;
    });
}


/*
    Event Listener: Reset button:
        -Activates resetProgress() method, additionally updates this information on the background and contentScript side to synchronise the reset with the frontend.

*/
document.addEventListener('DOMContentLoaded', function() {
    var link = document.getElementById('link');
    link.addEventListener('click', function() {
        resetProgress();
        chrome.runtime.sendMessage({
            msg: "hello"
        });
    })
});


/*
    Event Listener: Visualise button:
        -On click, this opens a new tab directed towards the AWS hosted visualisation engine, passing execution to Bokkeh.

*/
document.addEventListener('DOMContentLoaded', function() {
    var visualise = document.getElementById('visualise');
    visualise.addEventListener('click', function() {
        window.open("http://18.134.177.244/visualise", "_blank");
    })
})


/*
    Event Listener: Submit button:
        -On click, this unifies existing information gathered from the contentScript on the active page, and passes the information to the background script to be deployed on Firebase.

*/
document.addEventListener('DOMContentLoaded', function() {
    var link = document.getElementById('submit');
    link.addEventListener('click', function() {
        // chrome.runtime.sendMessage({
        //     msg: "getTestcases"
        // });

        //Sequentially access the non-persistent content page's local storage and squish together all the stored data into one JSON for a candidate page.
        chrome.storage.local.get('capture', function(data) {
            //By this point, the local storage should be updated with the latest result, we can now fetch it
            chrome.storage.local.get('performance', function(perf) {
                //Another internal to capture, the testcase performances 
                chrome.storage.local.get('testcases', function(cases) {
                    chrome.storage.local.get('problemName', function(problem) {
                        chrome.storage.local.get('sourceCode', function(source){
                            capture = {
                                'problemName' : problem.problemName,
                                'configuration' : data.capture,
                                'performance' : perf.performance,
                                'testcases' : cases.testcases,
                                'sourceCode' : source.sourceCode
                            };
    
                            chrome.runtime.sendMessage({
                                msg: "store",
                                data: capture
                            }); 
                        })

                    });
                });
                
            });
        });
    })

});

/*
    Event Listener: Coder Profile Generation:
        -On click, this passes execution to the background script, which fetches from Firebase and locally performs static analysis in the same way Bokkeh does to generate the coder profile + prediction
        -Ideally the static analysis data should be cached at a later point to reduce latency.
        -This takes all existing data (not necessarily from a completed solution, can be ongoing), and passes to BG script.
*/

document.addEventListener('DOMContentLoaded', function() {
    var button = document.getElementById('profile');
    button.addEventListener('click', function() {

        chrome.storage.local.get('capture', function(data) {
            chrome.storage.local.get('performance', function(perf) {
                chrome.storage.local.get('testcases', function(cases) {
                    chrome.storage.local.get('problemName', function(problem) {
                        chrome.storage.local.get('sourceCode', function(source){
                            capture = {
                                'problemName' : problem.problemName,
                                'configuration' : data.capture,
                                'performance' : perf.performance,
                                'testcases' : cases.testcases,
                                'sourceCode' : source.sourceCode
                            };
                            chrome.runtime.sendMessage({
                                msg: "generate-profile",
                                data: capture
                                
                            })
                            
                    });

                });
                
            });
        });
    });
    }
)});

/*
    updatePopup()
        -Method called whenever the extension's frontend is loaded (clicking on it in Chrome), it communicates with the background script to parse the latest contentScript-side information and updates
        the HTML elements accordingly.
*/
function updatePopup() {

    let test = {};
    chrome.runtime.sendMessage({
        msg: "fetch"
    });
    chrome.storage.local.get('capture', function(data) {
        capture = data.capture;
        document.getElementById('dimension').innerHTML = "Dimensions: " + capture.dimensions.first + "x" + capture.dimensions.second;
        document.getElementById('wpm').innerHTML = "WPM: " + Math.round(capture.wpm);
        console.log(capture.wpm)
    })


    console.log("stored!")
}


document.addEventListener('DOMContentLoaded', updatePopup);