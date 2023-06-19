import firebase_admin
import os
import numpy as np
from firebase_admin import credentials
from firebase_admin import db
import analysis

## Data from firebase to be tabulated in-order
## Detached to allow any two columns to be graphed against each other

user_dimensions = []
user_memoryperformance = []
user_timeperformance = []
user_successstate = []
user_testcasespassed = []
user_runtimerelativescore = []
user_memoryrelativescore = []
user_problem = []
user_typespeed = []
user_autocompleteStatus = []
user_backspaceCount = []
user_language = []
user_problemName = []
user_sourceCode = []
user_tabcount = []
user_usefulnessindex = []
user_cyclomaticcomplexity = []
user_totalpixels = []
user_commentlinedensities = []
user_commentchardensities = []
user_avgvarlengths = []
## Function: connectFirebase()
##          -Initiates the connection to the database where captured data is



def connectFirebase():
    ## Allowing for multiple refresh
    if not firebase_admin._apps:
    	cred = credentials.Certificate(os.getcwd() + "/visualise/leetcode-performance-analysis-firebase-adminsdk-45760-27f194eee0.json")
    	firebase_admin.initialize_app(cred, {'databaseURL': 'https://leetcode-performance-analysis-default-rtdb.europe-west1.firebasedatabase.app/'})


## Function: getUserData():
##          -Gathers total userdata collection from firebase
##          -Returns a dictionary object with all data entries
def getUserData():
    try:
        ref = db.reference('/capture/')
        userdata = ref.get()
        return userdata
    except Exception as e:
        print("Failed to extract from database: Error given - " + str(e))
        print("Verify if database connection is established")


## Function populateColumns():
##          -Takes dictionary from getUserData() as input, iterates in-order
##          to populate columns.

def populateColumns(userdata):
    for key, value in userdata.items():
        # if value['problemName'] == '5. Longest Palindromic Substring':
            user_dimensions.append(value['input_metrics']['dimensions'])
            user_typespeed.append(value['input_metrics']['wpm'])
            user_autocompleteStatus.append(value['input_metrics']['autoComplete'])
            user_backspaceCount.append(value['input_metrics']['backspaceCount'])
            user_language.append(value['input_metrics']['language'])

            user_problemName.append(value['problemName'])
            user_sourceCode.append(value['sourceCode'])
            user_successstate.append(value['successState'])
            user_testcasespassed.append(value['testcases']['passed'])

            if "tab_count" in value:
                user_tabcount.append(value['tab_count'])
            else:
                user_tabcount.append(0)
            if "usefulnessIndex" in value:
                user_usefulnessindex.append(value['usefulnessIndex'])
            else:
                user_usefulnessindex.append(0)


            if "performance" in value:
                user_memoryperformance.append(value['performance']['memoryUsage'])
                user_memoryrelativescore.append(value['performance']['memoryRelative'])
                user_timeperformance.append(value['performance']['runTime'])
                user_runtimerelativescore.append(value['performance']['runTimeRelative'])
            else:
                ##If memory performance, time performance items don't exist in a given
                ##data entry, this is an entry that did not complete the problem.
                user_memoryperformance.append("DNF")
                user_timeperformance.append("DNF")
                user_runtimerelativescore.append("DNF")
                user_memoryrelativescore.append("DNF")


## Function packageColumns():
##      -Packages populated columns into one dict object.
def packageColumns():

    userColumns = {}

    userColumns["problemname"] = user_problemName
    userColumns["dimensions"] = user_dimensions
    userColumns["memory_performance"] = user_memoryperformance
    userColumns["time_performance"] = user_timeperformance
    userColumns["wpm"] = user_typespeed
    userColumns["success_state"] = user_successstate
    userColumns["testcases_passed"] = user_testcasespassed
    userColumns["runtimerelativescore"] = user_runtimerelativescore
    userColumns["memoryrelativescore"] = user_memoryrelativescore
    userColumns["user_sourcecode"] = user_sourceCode
    userColumns["autocomplete"] = user_autocompleteStatus
    userColumns["language"] = user_language
    userColumns["backspaceCount"] = user_backspaceCount
    userColumns["tabCount"] = user_tabcount
    userColumns["usefulnessIndex"] = user_usefulnessindex


    return userColumns


## Function fetch_and_package():
##  Connects to database, collects and packages data and returns it as dict
def fetch_and_package():
    user_dimensions.clear()
    user_memoryperformance.clear()
    user_timeperformance.clear()
    user_successstate.clear()
    user_testcasespassed.clear()
    user_runtimerelativescore.clear()
    user_memoryrelativescore.clear()
    user_problem.clear()
    user_typespeed.clear()
    user_autocompleteStatus.clear()
    user_backspaceCount.clear()
    user_language.clear()
    user_problemName.clear()
    user_sourceCode.clear()
    user_tabcount.clear()
    user_usefulnessindex.clear()
    user_cyclomaticcomplexity.clear()
    user_totalpixels.clear()
    user_commentlinedensities.clear()
    user_commentchardensities.clear()
    user_avgvarlengths.clear()

    connectFirebase()
    userdata = getUserData()
    populateColumns(userdata)

    packagedData = packageColumns()
    return packagedData


'''
    filterSuccessfulSolutions():
        -Takes the userData dict object as an input and filters only submissions where the success state = TRUE

'''
def filterSuccessfulSolutions(userData):
    successful = {}

    for key, val in userData.items():
        successful[key] = []

    for i in range(len(userData["success_state"])):
        if userData["success_state"][i] is True:
            for key, val in userData.items():
                successful[key].append(val[i])

    for i in range(len(successful["memory_performance"])):
        successful["memory_performance"][i] = float(successful["memory_performance"][i].split("MB")[0])

    for i in range(len(successful["memoryrelativescore"])):
        successful["memoryrelativescore"][i] = float(successful["memoryrelativescore"][i].split("%")[0])

    for i in range(len(successful["runtimerelativescore"])):
        successful["runtimerelativescore"][i] = float(successful["runtimerelativescore"][i].split("%")[0])

    for i in range(len(successful["time_performance"])):
        successful["time_performance"][i] = float(successful["time_performance"][i].split("ms")[0])

    return successful

'''
    getDensities():
        -Takes flattened CPP code as input and returns the pair of comment densities (as defined by Aman and Okazaki)
'''
def getDensities(code):
    decompressed = analysis.decompress_cpp_code(code)
    densities = analysis.compute_comment_ratios(decompressed)
    return densities[0], densities[1] ## char and line densities respectively.


'''
    getAvgVarLength():
        -Takes flattened CPP code as input and returns the average variable length
'''
def getAvgVarLength(code):
    decompressed = analysis.decompress_cpp_code(code)
    avgvarlen = analysis.compute_average_varlength(decompressed)
    return avgvarlen

'''
    collateDensities():
        -Similar method used to gather all of the avgVar and density information when packaging the initial userdata object from FB.
'''
def collateDensities(userData):
    charDensities = []
    lineDensities = []

    lengths = []
    i = 0
    for code in userData["user_sourcecode"]:
        i = i + 1
        print(code)
        print(i)
        decompressed = analysis.decompress_cpp_code(code)
        print(decompressed)
        densities = analysis.compute_comment_ratios(decompressed)
        charDensities.append(densities[0])
        lineDensities.append(densities[1])
        lengths.append(analysis.compute_average_varlength(decompressed))

    return charDensities, lineDensities, lengths



'''
    collatePixels():
        -Simplifies display of dimensions for graphing by taking the product of h * W.
'''
def collatePixels(userData):


    totalPixels = []
    for i in userData["dimensions"]:
        totalPixels.append(i['first'] * i['second'])

    return totalPixels

def collateCyclomaticComplexities(userData):
    cyc = []
    for i in userData["user_sourcecode"]:
        cyc.append(analysis.compute_cyclomatic_complexity_cpp(i))

    return cyc

'''
    collateProblems():
        -Takes original userData dict as object input, returns a new userData object that is addressable by problem, with subchildren being the dimesnsions, etc.
        -This is so that it can be more easily passed on to Bokkeh for graphing.
'''
def collateProblems(original_dict):
    organized_dict = {}
    print("Conducting static analysis and packaging...")
    total = original_dict["problemname"]
    for i in range(len(total)):
        problem_name = total[i]
        densities = getDensities(original_dict['user_sourcecode'][i])
        if problem_name not in organized_dict:
            organized_dict[problem_name] = {'dimensions': [], 'memory_performance': [], 'time_performance': [],
                                            'wpm': [], 'success_state': [], 'testcases_passed': [], 'runtimerelativescore': [], 'memoryrelativescore': [], 'user_sourcecode': [], 'autocomplete': [], 'language': [], 'backspaceCount': [],
                                            'tabCount': [], 'usefulnessIndex': [], 'totalPixels': [], 'commentCharDensities': [], 'commentLineDensities': [], 'avgVarLength': [], 'cyclomaticComplexity': []}
        organized_dict[problem_name]['dimensions'].append(original_dict['dimensions'][i])

        if original_dict['memory_performance'][i] != 'DNF':
            organized_dict[problem_name]['memory_performance'].append(float(original_dict["memory_performance"][i].split("MB")[0]))
        else:
            organized_dict[problem_name]['memory_performance'].append(-1)

        if original_dict['time_performance'][i] != 'DNF':
            organized_dict[problem_name]['time_performance'].append(float(original_dict["time_performance"][i].split("ms")[0]))
        else:
            organized_dict[problem_name]['time_performance'].append(-1)

        organized_dict[problem_name]['wpm'].append(original_dict['wpm'][i])
        organized_dict[problem_name]['success_state'].append(original_dict['success_state'][i])
        organized_dict[problem_name]['testcases_passed'].append(original_dict['testcases_passed'][i])

        if original_dict['runtimerelativescore'][i] != 'DNF':
            organized_dict[problem_name]['runtimerelativescore'].append(float(original_dict['runtimerelativescore'][i].split("%")[0]))
        else:
            organized_dict[problem_name]['runtimerelativescore'].append(-1)

        if original_dict['memoryrelativescore'][i] != 'DNF':
            organized_dict[problem_name]['memoryrelativescore'].append(float(original_dict['memoryrelativescore'][i].split("%")[0]))
        else:
            organized_dict[problem_name]['memoryrelativescore'].append(-1)



        organized_dict[problem_name]['user_sourcecode'].append(original_dict['user_sourcecode'][i])
        organized_dict[problem_name]['autocomplete'].append(original_dict['autocomplete'][i])
        organized_dict[problem_name]['language'].append(original_dict['language'][i])
        organized_dict[problem_name]['backspaceCount'].append(original_dict['backspaceCount'][i])

        organized_dict[problem_name]['tabCount'].append(original_dict['tabCount'][i])
        organized_dict[problem_name]['usefulnessIndex'].append(original_dict['usefulnessIndex'][i])
        organized_dict[problem_name]['totalPixels'].append(original_dict['dimensions'][i]['first'] * original_dict['dimensions'][i]['second'])
        organized_dict[problem_name]['commentCharDensities'].append(densities[0])
        organized_dict[problem_name]['commentLineDensities'].append(densities[1])
        organized_dict[problem_name]['avgVarLength'].append(getAvgVarLength(original_dict['user_sourcecode'][i]))
        organized_dict[problem_name]['cyclomaticComplexity'].append(analysis.compute_cyclomatic_complexity_cpp(original_dict['user_sourcecode'][i]))
    print("Static Analysis Complete")
    return organized_dict

