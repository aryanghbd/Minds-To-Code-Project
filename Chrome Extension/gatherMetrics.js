/*
    File: gatherMetrics.js
        -This is the content script, injected locally into every active page and with local storage persistent only within the activity span of that specific tab.
        -We inject this into the LeetCode tab to parse all related data, and update data based on events occurring in that tab (i.e keystroke events for WPM).
*/


//Globals to update current values.
let currentDimensions = {};
let currentProblem = "";
let typing = "";
let currentWPM = 0;
let autoComplete = false;
let currentCode = "";
let currentTabs = 0;
let backspaceCount = 0;

let overallStart = 0;
let start = 0;
let timeElapsed = 0;

let intermittence = 0;
let timeTyping = 0;

capturePoint = {
    'dimensions': {},
    'wpm' : 0
};

//When a keystroke is detected we will recalculate WPM and other data.
window.addEventListener('keydown', handleInput, true);



function getWidth() {
    return Math.max(
      document.body.scrollWidth,
      document.documentElement.scrollWidth,
      document.body.offsetWidth,
      document.documentElement.offsetWidth,
      document.documentElement.clientWidth
    );
  }
  
  function getHeight() {
    return Math.max(
      document.body.scrollHeight,
      document.documentElement.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.offsetHeight,
      document.documentElement.clientHeight
    );
  }


/*
  handleInput():
    -Main method to grab data on every keystroke, this is mainly needed for the WPM however all other data for ease of use is synchronised on keystroke too.

*/
function handleInput(event){
    var input = event.which || event.keyCode;
    
    //Handle unique keycodes (spacing and backspacing.)
    if(input == 13) {
        currentCode += "\n";
    }
    else if(input == 8) {
        currentCode.slice(0, currentCode.length - 1);
        backspaceCount = backspaceCount + 1;
    }
    else
    {
        if(input != 91 && input != 16 && input != 20 && input != 9 && input != 37 && input != 38 && input != 39 && input != 40) {
            //Deal with some exceptional keycodes.
            currentCode += event.key;
        }
    }

    console.log(input);
    if(input != 13 && input != 17 && input != 18){

        if(typing.length == 0){
            overallStart = window.performance.now();
            start = window.performance.now();
        }
        end = window.performance.now();
        timeElapsed = end - start;
        start = window.performance.now();
        //We advance the timer during the keystrokes to get an approximation of the WPM
        if(timeElapsed > 1000){
            intermittence += timeElapsed;
        }
        
        
        if(input != 8){
            let typed = String.fromCharCode(input).toLowerCase();
            typing = typing + typed;
        }
        else{
            typing = typing.slice(0, typing.length - 1);
        }

        masterElapsed = window.performance.now() - overallStart;
        finaltime = masterElapsed - intermittence;
        currentWPM = Math.round((typing.length/(finaltime/1000/60))/5);
        console.log(currentWPM);
        

        //Parse the DOM elements too: These are constant across all problems and will give us extra info to key in - i.e keying into databse b y problem title or by language.
        var problemTitle = document.getElementsByClassName('css-v3d350')[0].innerText;
        var languageChoice = document.getElementsByClassName('ant-select-selection-selected-value')[0].innerText;
        

        if(document.getElementsByClassName('css-1v05lsv-StyledSpan').length) {
            autoComplete = true;
        }
        else {
            autoComplete = false;
        }

        currentProblem = problemTitle;
        console.log(autoComplete);  


        //Update the local storage based on latest synchronised information. Including dimensions.
        chrome.storage.local.set({'wpm': currentWPM});
        currentDimensions = {'first' : getWidth(), 'second' : getHeight()};
        chrome.storage.local.set({'dimensions' : currentDimensions});
        capturePoint = {
            'dimensions' : currentDimensions,
            'wpm' : currentWPM,
            'language' : languageChoice,
            'backspaceCount' : backspaceCount,
            'autoComplete' : autoComplete
        };

        //Instead of getting all the keys typed so far which was what we did at the start, we just parse the code block in the LeetCode page which is more effective, gets the code and is pre-formatted.
        const codeDivs = document.getElementsByClassName("CodeMirror-lines");
        const codediv = codeDivs[0].innerText;
        const src = codediv.replace(/^\d+\n/gm, "");
        const flatten = src.replace(/\n/g, ' ').replace(/\s+/g, ' ');
        //Flatten the code for later static analysis (assumes flattened.)
        console.log(flatten)

        chrome.storage.local.set({'problemName' : problemTitle})
        chrome.storage.local.set({'sourceCode' : src})
        chrome.storage.local.set({'capture' : capturePoint});
    }
}

//Event Listeners for change in tab visibility, tab loading, etc to sync data.
document.addEventListener("visibilitychange", function () {
    if(!document.hidden) {
        chrome.storage.local.set({'wpm': currentWPM});
        chrome.storage.local.set({'dimensions' : currentDimensions});
        chrome.storage.local.set({'capture': capturePoint});
        chrome.storage.local.set({'problemName' : currentProblem})
        chrome.storage.local.set({'sourceCode' : currentCode})
    }
}, false);

window.addEventListener('load', (event) => {
    if(!document.hidden) {
        chrome.storage.local.set({'wpm': currentWPM});
        chrome.storage.local.set({'dimensions' : currentDimensions});
        chrome.storage.local.set({'capture': capturePoint});
        chrome.storage.local.set({'problemName' : currentProblem})
        chrome.storage.local.set({'sourceCode' : currentCode})
    }
});

function updateMetrics() {
    //Procced during interactions with extension frontend.
    typing = "";
    currentWPM = 0;
    currentDimensions = {};
    capturePoint = {};
    currentProblem = "";

    chrome.storage.local.set({'dimensions' : currentDimensions});
    chrome.storage.local.set({'wpm': currentWPM})
    chrome.storage.local.set({'capture': capturePoint});
    chrome.storage.local.set({'problemName' : currentProblem})
    chrome.storage.local.set({'sourceCode' : currentCode})
}

function getResults() {
    //Called only when the LeetCode submission button is clicked to parse performance data (if unsuccessful, this data will be blank and background script logic will treat as a failed submission.)
    var runTime = document.getElementsByClassName('data__HC-i')[0].innerText;
    var timeRelativePerformance = document.getElementsByClassName('data__HC-i')[1].innerText;

    var memoryUsage = document.getElementsByClassName('data__HC-i')[2].innerText;
    var memoryRelativePerformance = document.getElementsByClassName('data__HC-i')[3].innerText;

    var results = {
        'runTime' : runTime,
        'runTimeRelative' : timeRelativePerformance,
        'memoryUsage' : memoryUsage,
        'memoryRelative' : memoryRelativePerformance
    };
    console.log(results);
    chrome.storage.local.set({'performance' : results});

    
}


function getTestcases() {
        //Follow the table corresponding to the topmost leetcode submission, get the link and follow it to grab testcase passing information.
        res = 0
        var table = document.querySelector('.ant-table-body');
        var row = table.querySelector('.ant-table-row');
        var cells = row.querySelectorAll('td');

        var data = {
            timeSubmitted: cells[0].innerText,
            status: cells[1].querySelector('a').innerText,
            statusLink: cells[1].querySelector('a').getAttribute('href'),
            runtime: cells[2].innerText,
            memory: cells[3].innerText,
            language: cells[4].innerText
        };

        console.log(data);

        var newTab = window.open(data.statusLink, '_blank');

        newTab.onload = function() {
            var resultProgress = newTab.document.querySelector('#result_progress').innerText;
            chrome.runtime.sendMessage({msg: "submission", resultProgress: resultProgress});
            newTab.close();
        };
}

