/*
  File: background.js:
    -Contains underlying browser-session wide logic for server communications, as well as database interactions.


*/


// Globals here needed to update ratio of useful tabs etc whenever a tab creation/deletion event happens.
currentTabs = 0
usefulTabCount = 0
usefulnessIndex = 0
testcases = ""
tabs = []
useful = ["Stack Overflow", "C++"]

// ChatGPT API credentials
// const API_ENDPOINT = 'https://api.openai.com/v1/chat/completions';
const API_KEY = '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';



// Whenever an event happens or the extension is interacted with, we should get the latest set of data from the contentScript.

chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.msg === "hello") {
            chrome.tabs.executeScript(null, {code:"updateMetrics();"});
        }
    }
)


// Logic for when a tab is deleted, we keep a record of all tab titles at the time temporarily for calculation.
chrome.tabs.onRemoved.addListener(function() {
    tabs = []
    chrome.windows.getAll({populate:true}, function(windows) {
        windows.forEach(function(window) {
          window.tabs.forEach(function(tab) {
            tabs.push(tab.title);
          }); 
        });
    });

    currentTabs = tabs.length;
    console.log(tabs);
});


//Whenever the active tab changes. We perform a quick sanity check to recalculate the usefulness index, this is done by iterating through the tab titles and using .includes() in JS to match the title against our
//chosen buzzwords of interest ('Stack Overflow', 'C++') - if we get a hit, we iterate the usefultabcount, the ratio of this number against the total number of tabs gives us the usefulness index.

//Note that this is very extensible, as you need only add other keywords of interest to the 'useful' array at the top of the file.


chrome.tabs.onSelectionChanged.addListener(function(tabId, selectInfo) {
    chrome.tabs.get(tabId, function(tab) {
      console.log('Tab changed:', tab);
    });

    tabs = [];
    usefulTabCount = 0;
    usefulnessIndex = 0;
    chrome.windows.getAll({populate:true}, function(windows) {
        windows.forEach(function(window) {
          window.tabs.forEach(function(tab) {
             tabs.push(tab.title);
             if(tab.title.includes(useful[0]) || tab.title.includes(useful[1])) {
                console.log("We have a useful tab");
                usefulTabCount++;
                console.log(usefulTabCount);
             }
          }); 
        });
    });

    //Timeout necessary here in order to keep up with any new tabs or changes.
    setTimeout(function() {
        usefulnessIndex = usefulTabCount / tabs.length;
        console.log("Usefulness index is " + usefulnessIndex);
    }, 1000);
    

    console.log(tabs);
    
  });


//Event listener for getting performance related results from the active page (time and memory consumption) that you can get after submitting on LeetCode.
//Calls 'getResults()' from gatherMetrics.js to parse the HTML elements directly.
chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
        if(request.msg === "fetch") {
            chrome.storage.local.set({'performance' : {}});
            chrome.tabs.executeScript(null, {code: "getResults();"});
        }
    }   
)


//Separate chrome listener to update tab information if a new tab is created, ratios updated when tab changed
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    tabs = [];
    chrome.windows.getAll({populate:true}, function(windows) {
        windows.forEach(function(window) {
          window.tabs.forEach(function(tab) {
            if(!tabs.includes(tab.title)) {
                tabs.push(tab.title);
            }
          }); 
        });
    });
});


//Main logic to store database to Firebase.
/*
  Logic:
    -When the submission button is clicked on the extension, a message 'store' is sent to the background script, with the request data containing the JSON data from the active page (LeetCode)
    -This data must be unified with the testcase data, which is on a different tab and thus must be fetched separately to avoid losing the existing non-persistent content data.

    -We nest two different listeners (to avoid testcase data from previous problems not synchronising with the latest problem). getTestcases() is called from gatherMetrics.js to follow the 
    HREF associated with the topmost (most recent) submission on LeetCode, from there the testcase data is parsed and the new tab closed, after passing the data to the background script.

    -From here, the testcase data is unified with the original tab data to create one submission datapoint (JSON), which is then uploaded to Firebase.
*/
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
  if(request.msg === "store") {

      let submissionListener = function(req, sender, sendResponse) {
          if(req.msg == "submission") {
              console.log(req.resultProgress);
              var testcasesPassed = parseInt(req.resultProgress.split(' / ')[0], 10);
              var testcasesTotal = parseInt(req.resultProgress.split(' / ')[1], 10);
              console.log(testcasesPassed);

              testcasedata = {
                "passed": testcasesPassed,
                "total": testcasesTotal
              }
              
              let successState = true;
              //Active low - Assume the submission is completely correct unless we do not have a Performance datapoint, which can only be parsed if the LeetCode submission passed all testcases anyway, if this
              //datapoint doesn't exist we know the submission failed at least 1 testcase and set the value to false.
              if (!request.data.performance) {
                  successState = false;
              }
              
              firebase.database().ref('/capture/' + Date.now()).set({
                  problemName: request.data.problemName,
                  input_metrics: request.data.configuration,
                  performance: request.data.performance,
                  successState: successState,
                  testcases: testcasedata,
                  sourceCode: request.data.sourceCode,
                  tab_count: tabs.length, 
                  usefulnessIndex: usefulnessIndex 
              });

              chrome.runtime.onMessage.removeListener(submissionListener);
              //Remove listener to clear any local storage and prevent testcase data leaking into subsequent submissions.
          }

          return true;
      };

      // Add the submissionListener back in so that we can get the latest set of testcases.
      chrome.runtime.onMessage.addListener(submissionListener); 
      chrome.tabs.executeScript(null, {code: 'getTestcases()'});
  }
});


/*
  Set of Static Analysis Functions:
    -This is exactly the same as that seen on the Python-side - this is used when generating a profile by taking the current problem and computing the relevant metrics in order to predict the sort of code
    that the current user's behaviour inputs would lead to.

*/


/*
  computeCommentRatios():

    -Takes in the flattened source code from Firebase as input, we then reformat the code and regex against C++ comment markers in order to get the comment line and character densities.

*/

function computeCommentRatios(sourceCode) {
    const singleLineCommentRegex = /\/\/.*/
    const multiLineCommentRegex = /\/\*[\s\S]*?\*\//
  
    //match for block and line comms.
    const singleLineComments = sourceCode.match(singleLineCommentRegex) || []
    const multiLineComments = sourceCode.match(multiLineCommentRegex) || []
  
    const commentChars = singleLineComments.reduce((sum, comment) => sum + comment.length, 0) +
      multiLineComments.reduce((sum, comment) => sum + comment.length, 0)
    const commentLines = singleLineComments.length +
      multiLineComments.reduce((sum, comment) => sum + comment.split('\n').length - 1, 0)

    const totalChars = sourceCode.length
    const totalLines = sourceCode.split('\n').length
  
    // final ratio - COMd and COMl based on amal research.
    const commentCharsRatio = commentChars / totalChars
    const commentLinesRatio = commentLines / totalLines
    return {commentCharsRatio, commentLinesRatio}
  }
  
  

  /*
    decompressCppCode():
      -This is used to unflatten the flattened code from Firebase in order to perform static analysis functions later down the line. Basically just breaking by newlines and spaces.

  */
  function decompressCppCode(code) {
    let formatted = '';
    let indentLevel = 0;
    for (let i = 0; i < code.length; i++) {
      const c = code[i];
      if (c === '{') {
        formatted += c + '\n' + '    '.repeat(indentLevel + 1);
        indentLevel++;
      } else if (c === '}') {
        indentLevel--;
        formatted = formatted.slice(0, -4);
        formatted += '\n' + '    '.repeat(indentLevel) + c;
      } else if (c === ';') {
        formatted += c + '\n' + '    '.repeat(indentLevel);
      } else if (c === '\n') {
        continue;
      } else {
        formatted += c;
      }
    }
    return formatted;
  }
  
  /*
    helper function - this is needed because different problems will have different numbers of testcases and relevant performances, some of which will have more variance than others due to multiple approaches. So
    this will provide a unified perspective.
  */
  function normalizeData(value, data) {
    const min = Math.min(...data)
    const max = Math.max(...data)

    return (value - min) / (max - min)
  
  }

  /* 
    another static analysis function to get avgvarlen, same as the one from Python by just matching regexs.
  */
  function computeAverageVarLength(sourceCode) {
    const variableRegex = /\b(?:int|float|double|bool|char|std::string|(?:std::vector|std::unordered_map)<.*?>)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g;
  
    const variableNames = [...sourceCode.matchAll(variableRegex)].map(match => match[1]);
  
    const avgLength = variableNames.reduce((sum, name) => sum + name.length, 0) / variableNames.length;
  
    return avgLength;
  }
  
  
  
  
/*
  Main Listener for generating a coding profile:

    Logic:
      -First - we perform a fetch from the firebase DB. We filter against the 'problemName' field in each candidate solution for the current active LeetCode problem, fetching those submissions.

      -Then, we take the behavioural inputs of interest from each solution, i.e the WPM, Usefulness, Window Size etc in order to get an idea of the averages for this problem.

      -Then we do K Nearest Neighbours approach (lack of large dataset) taking the current user's live behavioural inputs against the existing submission inputs in order to find the 2 submissions closest to 
      the current user. We then index against these submissions to find the relevant final metrics (i.e comment ratios, testcases passed, performance, etc) and get the mean of the two submissions as the 'predicted'
      final performance of the user. 

      -These values are normalised and passed on to radar.js in order to generate the radar graph profiling the user, based on the 4 qualities (see report).

      -ChatGPT API is also used to provide human-like response and suggestions on behavioural improvements, passing on the conjectures found in the report. Predicted data and behavioural data is passed on, page opened when
      API responds.

*/
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if(request.msg === "generate-profile") {
        console.log(request.data)
        var ref = firebase.database().ref('/capture');
        ref.once('value', function(snapshot) {
            console.log(snapshot.val());
            const commentRatios = [];
            const varLengths = [];
            const problemData = [];
            const wpms = [];

            const modelInputs = []
            const modelOutputs = []

            snapshot.forEach((childSnapshot) => {
              const childData = childSnapshot.val();
              if(childData.problemName === request.data.problemName) {
                const candidateOutputs = {
                    "commentDensity" : computeCommentRatios(decompressCppCode(childData.sourceCode)).commentCharsRatio,
                    "avgVarLen" : computeAverageVarLength(decompressCppCode(childData.sourceCode)),
                    "testCasesPassed" : childData.testcases.passed/childData.testcases.total,
                    "success" : childData.successState
                }
                const candidateInputs = {
                    "wpm" : childData.input_metrics.wpm,
                    "dimensions" : childData.input_metrics.dimensions.first * childData.input_metrics.dimensions.second,
                    "usefulnessIndex" : childData.usefulnessIndex,
                    "backspace" : childData.input_metrics.backspaceCount
                };
                
                problemData.push(childData);
                modelInputs.push(candidateInputs)
                modelOutputs.push(candidateOutputs)
                wpms.push(childData.input_metrics.wpm)
                commentRatios.push(computeCommentRatios(decompressCppCode(childData.sourceCode)).commentCharsRatio)
                varLengths.push(computeAverageVarLength(decompressCppCode(childData.sourceCode)))
              }
            });
            const input = {
                wpm: request.data.configuration.wpm,
                dimensions: request.data.configuration.dimensions.first * request.data.configuration.dimensions.second,
                usefulnessIndex: usefulnessIndex,
                backspace: request.data.configuration.backspaceCount
            };
            
            var WPMsum = wpms.reduce(function (accumulator, currentValue) {
              return accumulator + currentValue;
            }, 0);
            
            var meanWPM = WPMsum/wpms.length;


            const distances = [];
            for (let i = 0; i < modelInputs.length; i++) {
                const modelInput = modelInputs[i];
                
                dist1 = Math.pow((input.wpm - modelInput.wpm), 2)
                dist2 = Math.pow((input.dimensions - modelInput.dimensions), 2)
                dist3 = Math.pow((input.usefulnessIndex - modelInput.usefulnessIndex), 2)
                dist4 = Math.pow((input.backspace - modelInput.backspace), 2)

                const distance = Math.sqrt(dist1 + dist2 + dist3 + dist4);
              

              
                distances.push(distance);
            }
            
            const nearestIndex = distances.indexOf(Math.min(...distances));

            distances[nearestIndex] = Infinity;

            const secondNearestIndex = distances.indexOf(Math.min(...distances));

            const firstNearestOutput = modelOutputs[nearestIndex];
            const secondNearestOutput = modelOutputs[secondNearestIndex];
            
            const prediction = {
                commentDensity: (firstNearestOutput.commentDensity + secondNearestOutput.commentDensity)/2,
                avgVarLen: (firstNearestOutput.avgVarLen + secondNearestOutput.avgVarLen)/2,
                testCasesPassed: (firstNearestOutput.testCasesPassed + secondNearestOutput.testCasesPassed)/2 > 0.9 ? 1 : (firstNearestOutput.testCasesPassed + secondNearestOutput.testCasesPassed)/2,
                success: (firstNearestOutput.testCasesPassed + secondNearestOutput.testCasesPassed)/2 > 0.9 ? 1 : (firstNearestOutput.success && secondNearestOutput.success)
            };

            const radarPreProc = {
                normCommDensity: normalizeData(prediction.commentDensity, commentRatios),
                normavgVarLen: normalizeData(prediction.avgVarLen, varLengths),
                normTCPassed: prediction.testCasesPassed,
                success: prediction.success
            }
            console.log(radarPreProc)
            console.log(normalizeData(input.wpm, wpms))
            console.log(wpms)
            var toRadar = [input.usefulnessIndex, (radarPreProc.normCommDensity + radarPreProc.normavgVarLen)/2, normalizeData(input.wpm, wpms), radarPreProc.normTCPassed]
            console.log(prediction);
            console.log(toRadar)


              async function queryGptApi() {
                var feedback = `You are part of a Chrome Extension trying to evaluate optimal coding behaviours, so please give an appropriate, suggestive response. The conjectures suggest the following: 1) Display Size has a linear scaling with expected passed test cases, 2) Typing speed in WPM scales parabolically, too fast can be detrimental as you are more likely to make mistakes, this should be mirrored with backspace frequency. 3) Useful tab ratio (i.e the ratio of relevant coding tabs such as documentation or Stack Overflow) benefits performance. Readability (i.e comment density and average variable lengths) are also impacted by these metrics. 

                You are given the following user report via API. 1: WPM is: ${input.wpm}, note that the mean WPM for this problem was ${meanWPM}, so compare. The usefulness ratio of this user was ${toRadar[0]}, the normalised predicted comment density based on these values was ${radarPreProc.normCommDensity}, so comment on the implications of the behaviours on the density and how this impacts the performance. The dimensions were ${request.data.configuration.dimensions.first} x ${request.data.configuration.dimensions.second}, note that data suggests that display size may impact usefulness to an extent, so give suggestions behaviourally on this too. 
                
                Give it as an overall critique of the user’s behaviours and suggest ways to improve. Note that the comment density is in fact a projection, which is impacted based on the WPM and the display size, so improving the comment density would be a matter of improving these input behaviours, keep that in mind in the answer. The predicted passed test case rate for this user is ${radarPreProc.normTCPassed}. The test case passing (functional performance) is directly correspondent to display size and usefulness, but WPM can interfere with this if too fast (with a lot of backspaces being an indicator), the user has a backspace frequency of ${input.backspace}. 
                
                Speak as if you are speaking to the user since this is an API call and will go on the interface. Give pragmatic suggestions based on the data given, particularly as large display sizes should exhibit good usefulness indices. If the index is bad, then relate these two and suggest things about tabs. Otherwise, small display sizes have been shown to have worse indices, so that is a good suggestion too. If deemed 'too fast' or 'too slow' typing with relation to backspace frequency, give directions to the user. If the values are extreme or if comment quality, etc., is low, or if test case pass prediction is low, talk about these (you don’t have to say the value predicted), but give reasoning behind the prediction based on the data and hypotheses given. Talk about how to improve these projected metrics based on changes in input behaviours if you deem any of them problematic (display size, typing speed, useful tabs). Remember, you are speaking to the user. 
                
                Also, don’t be too general; be specific to that user. Remember that this is a LeetCode problem, so you want the test case pass to be near 1; otherwise, it’s problematic. Don’t be too vague.`;
                const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer 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'
                },
                

                body: JSON.stringify({
                  model: 'gpt-3.5-turbo',
                  messages: [{"role": "user", "content": feedback}],
                  max_tokens: 600
                })
              });
              const data = await response.json();
            
              if (response.ok) {
                return data.choices[0]
              } else {
                throw new Error(data.error.message);
              }
            }    
            alert('Loading...');

            queryGptApi()
            //Only open radar graph when we have the full API response otherwise we will get a blank page.
              .then(response => {
                chrome.tabs.create({ url: chrome.extension.getURL(`radar.html?data=${encodeURIComponent(JSON.stringify(toRadar))}&feedback=${encodeURIComponent(JSON.stringify(btoa(response.message.content)))}`) });
                console.log(response)
              })
              .catch(error => console.error(error));
            


            
        });


    }
});