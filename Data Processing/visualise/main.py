import pandas as pd
import numpy as np
from bokeh.layouts import column, row
from bokeh.models import Select, Button, HoverTool, ColumnDataSource, Toggle
from bokeh.palettes import Spectral5
from bokeh.plotting import curdoc, figure
from bokeh.models import SaveTool, Toolbar
from bokeh.layouts import gridplot
from scipy.optimize import curve_fit
from bokeh.models import Span
import itertools
import util
import json
import os


userData = {}
userData = util.fetch_and_package()
print(len(userData['problemname']))

# First, check if the file exists, if it doesn't we have to fetch anyways, if it does, check length

print("Checking existence of cached data...")
if os.path.exists("visualise/cached_userdata.json"):
    print("Cached database JSON detected, attempting load...")
    #If the file exists, first check against raw DB length against the cached data length
    #If the lengths are the same, we can just reload the existing JSON file to avoid performing duplicate calculation
    with open("visualise/cached_userdata.json") as f:
        temp = {}
        temp = json.load(f)

    sum = 0
    for i in temp:
        sum += len(temp[i]["dimensions"])

    if(len(userData['problemname']) == sum):
        print("Data unchanged since last refresh, loading cached data.")
        userData = temp

    else:

        ## Otherwise, we need to reload the 'cache', this involves having to perform static analysis functions with the new data and overwriting the JSON.
        print("New data has been submitted since last use, reloading cache")
        userData = util.collateProblems(userData)
        with open("visualise/cached_userdata.json", "w") as f:
            json.dump(userData, f)

else:
    # If the file did not exist (first time use case), then we have to perform the calculations and cache regardless.
    print("First time use detected, caching data from Firebase...")
    userData = util.collateProblems(userData)
    with open("visualise/cached_userdata.json", "w") as f:
        json.dump(userData, f)


'''
Optimisation: Around this point, we will cache the data, this can be try except or some other way, this is to save us from having to re-calculate each time we 
refresh the page.

Logic:
    -We perform an initial fetch, we compare the length of the fetched info with the cached JSON file (from collateProblems()), if we find that the length is different,
    then it means that there has been new data since the last refresh and we have a 'cache miss', we need to perform collateProblems() again, if we find the length is the
    same, then we can simply load the JSON generated without having to perform excessive calculation, this should significantly shave latency. 
'''


'''
    set initial problem for first load, chose this leetcode problem as this had the most metrics implemented at time of making
'''
selected_problem = '5. Longest Palindromic Substring'
df = pd.DataFrame(userData[selected_problem])
df_str = df.astype(str)


SIZES = list(range(6, 22, 3))
COLORS = Spectral5
N_SIZES = len(SIZES)
N_COLORS = len(COLORS)

# Data cleanup
discrete = [x for x in df.columns if df[x].dtype == object]
continuous = [x for x in df.columns if x not in discrete]


'''
    filter_success(active):
        -This method allows the user to toggle showing only the datapoints where userData["success_state"] == True. 
        -Active is active-high, meaning that toggling will change the dataframe we use to display the data.
        
        -NOTE: There is a bug when integrating this with the hover tool, Bokkeh does not appear to support objects in hover tool, so unfortunately we must keep
        everything in int form for now, as preprocessing did not seem to display dimension/non-int data as from Firebase. 
            -Issue appears to be with source, as we cast to string to display the data but this means that matplotlib/bokkeh is unable to plot the points.
'''

def filter_success(active):
    ## Toggle function allows us to display only successful sols or not for clearer distributions
    global df
    global source
    if active:
        df = df[df["success_state"] == True]
    else:
        df = pd.DataFrame(userData[selected_problem])
    source.data = ColumnDataSource.from_df(df)


'''
    all_axes_combinations():
        -Generates all possible permutations of metrics for graphing in the grid button.
'''
def all_axes_combinations(axes):
    return list(itertools.combinations(axes, 2))


'''
    create_grid():
        -Tied to grid button on Bokkeh, grabs list of possible permutations and repeatedly calls create_figure() on them.
'''
def create_grid():
    ## Generate all permutations of axis combos and then repeatedly call the singular figure function.
    axes_combinations = all_axes_combinations(continuous)
    figures = []
    for i, (x_axis, y_axis) in enumerate(axes_combinations):
        figures.append(create_figure(x_axis, y_axis))
    return gridplot(figures, ncols=5)


source = ColumnDataSource(df)
## To fix hover tool not displaying individual data - note there is a bug where dimensions does not show properly.


'''
    create_figure():
        -Generates single plot figure, applies matplotlib model to get sum of least squares to choose curve or line.
        
'''
def create_figure(x_axis, y_axis):
    global df
    global userData

    x_title = x_axis.title()
    y_title = y_axis.title()

    kw = dict()
    if x_axis in discrete:
        kw['x_range'] = sorted(set(df[x_axis]))
    if y_axis in discrete:
        kw['y_range'] = sorted(set(df[y_axis]))
    kw['title'] = "%s vs %s" % (x_title, y_title)

    p = figure(height=500, width=500, tools='pan,box_zoom,reset', **kw)
    p.xaxis.axis_label = x_title
    p.yaxis.axis_label = y_title

    if x_axis in discrete:
        p.xaxis.major_label_orientation = np.pi / 4

    sz = 9
    if size.value != 'None':
        groups = pd.qcut(df[size.value].values, N_SIZES, duplicates='drop')
        sz = [SIZES[xx] for xx in groups.codes]

    c = "#31AADE"
    if color.value != 'None':
        groups = pd.qcut(df[color.value].values, N_COLORS, duplicates='drop')
        c = [COLORS[xx] for xx in groups.codes]

    p.circle(x=x_axis, y=y_axis, color=c, size=sz, line_color="white", alpha=0.6, hover_color='white', hover_alpha=0.5, source=source)

    ## Iterate all columns to display over each point
    hover = HoverTool()
    hover.tooltips = [
        ## Work around for dimensions
        (col, '@' + col) if col != 'dimensions' else ('dimensions', '@dimensions{safe}') for col in df.columns
    ]
    hover.attachment = 'right'
    p.add_tools(hover)

    ## Get residuals, apply deg 1 and 2 and see which is smaller

    if x_axis not in discrete and y_axis not in discrete:
        xs = df[x_axis].values
        ys = df[y_axis].values
        try:
            coef_line = np.polyfit(xs, ys, 1)
            line = np.poly1d(coef_line)

            coef_curve = np.polyfit(xs, ys, 2)
            curve = np.poly1d(coef_curve)

            residuals_line = ys - line(xs)
            residuals_curve = ys - curve(xs)
            ssr_line = np.sum(residuals_line ** 2)
            ssr_curve = np.sum(residuals_curve ** 2)

            if ssr_line < ssr_curve:
                x_line = np.linspace(min(xs), max(xs), 100)
                p.line(x_line, line(x_line), color='red', line_width=2)
            else:
                x_curve = np.linspace(min(xs), max(xs), 100)
                p.line(x_curve, curve(x_curve), color='red', line_width=2)
        except np.linalg.LinAlgError:
            ## Ugh, some of the metrics give rank errors on matplotlib, this is a bit ugly but we can just choose not to display certain permutations.
            print(f"Could not fit a trendline for {x_axis} vs {y_axis}")

    return p


def update(attr, old, new):
    global df
    selected_problem = problem_select.value
    df = pd.DataFrame.from_dict(userData[selected_problem])


'''
    Toggling between grid display or single graph display.
'''
def switch_to_grid():
    layout.children[1] = create_grid()

def switch_to_single():
    layout.children[1] = create_figure(x.value, y.value)

x = Select(title='X-Axis', value='wpm', options=continuous)
x.on_change('value', update)

y = Select(title='Y-Axis', value='backspaceCount', options=continuous)
y.on_change('value', update)

size = Select(title='Size', value='None', options=['None'] + continuous)
size.on_change('value', update)

color = Select(title='Color', value='None', options=['None'] + continuous)
color.on_change('value', update)

problem_select = Select(title="Problem", value=selected_problem, options=list(userData.keys()))
problem_select.on_change("value", update)

grid_button = Button(label="Switch to Grid View", button_type="success")
grid_button.on_click(switch_to_grid)

single_button = Button(label="Switch to Single View", button_type="primary")
single_button.on_click(switch_to_single)

success_button = Toggle(label="Toggle Viewing only Successful Submissions", button_type="success", active=False)
success_button.on_click(filter_success)

controls = column(problem_select, x, y, color, size, grid_button, single_button, success_button, width=200)
layout = row(controls, create_figure(x.value, y.value))


curdoc().add_root(layout)
curdoc().title = "Minds To Code - Visualiser"
