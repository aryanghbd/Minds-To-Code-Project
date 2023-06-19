import matplotlib.pyplot as plt
import util
import time
import clang.cindex
import re
import os
import numpy as np


'''
    AWS has an older version of Clang, therefore there is a difference between whether you're using the visualisation engine locally or on the cloud, uncomment the commented line and comment the other line to switch.
'''
## '/usr/lib64/libclang.so.15' for AWS
clang.cindex.Config.set_library_file('/usr/lib64/libclang.so.15')


def generateGraph(x_axis, y_axis, x_name, y_name, degree, type : str):

    x_axis = np.array(x_axis)
    y_axis = np.array(y_axis)

    if type.lower() == "bar":
        plt.bar(x_axis, y_axis)

    elif type.lower() == "scatter":
        coefficients_line = np.polyfit(x_axis, y_axis, 1)
        coefficients_curve = np.polyfit(x_axis, y_axis, degree)
        residuals_line = y_axis - (coefficients_line[0] * x_axis + coefficients_line[1])

        poly = np.poly1d(coefficients_curve)
        residuals_curve = y_axis - poly(x_axis)

        ssr_line = np.sum(residuals_line**2)
        ssr_curve = np.sum(residuals_curve**2)

        if ssr_line < ssr_curve:
            plt.plot(x_axis, coefficients_line[0] * x_axis + coefficients_line[1], '-r')
        else:
            x_curve = np.linspace(min(x_axis), max(x_axis), 100)
            plt.plot(x_curve, poly(x_curve), '-r')

        plt.scatter(x_axis, y_axis)

    elif type.lower() == "fill between":
        plt.fill_between(x_axis, y_axis)

    plt.title("Distribution: " + y_name + " against " + x_name)
    plt.xlabel(x_name)
    plt.ylabel(y_name)

    plt.savefig(type + "graph" + str(time.time()) + ".png")
    plt.ylim(0, None)
    plt.xlim(0, None)
    plt.savefig(type + "graph" + str(time.time()) + "lim.png")
    plt.show()


def analyseComments():
    userData = util.fetch_and_package()

    sourceCodes = []
    for source in userData["user_sourcecode"]:
        sourceCodes.append(source)

    print(sourceCodes)



def compute_cyclomatic_complexity_cpp(source_code):
    index = clang.cindex.Index.create()
    tu = index.parse('tmp.cpp', args=['-std=c++11'], unsaved_files=[('tmp.cpp', source_code)])
    complexity = 1

    for node in tu.cursor.walk_preorder():
        if node.kind == clang.cindex.CursorKind.COMPOUND_STMT:
            num_children = sum(1 for _ in node.get_children())
            complexity += num_children - 1
        elif node.kind == clang.cindex.CursorKind.IF_STMT:
            complexity += 1

    return complexity + 1

def compute_average_varlength(source_code):
    variable_regex = r'\b(?:int|float|double|bool|char|std::string|(?:std::vector|std::unordered_map)<.*?>)\s+([a-zA-Z_][a-zA-Z0-9_]*)'

    variable_names = re.findall(variable_regex, source_code)

    avg_length = sum(len(name) for name in variable_names) / len(variable_names)

    return avg_length

def compute_comment_ratios(source_code):
    single_line_comment_regex = r'//.*'
    multi_line_comment_regex = r'/\*.*?\*/'

    single_line_comments = re.findall(single_line_comment_regex, source_code, re.MULTILINE)
    multi_line_comments = re.findall(multi_line_comment_regex, source_code, re.DOTALL)

    comment_chars = sum(len(comment) for comment in single_line_comments) + sum(
        len(comment) for comment in multi_line_comments)
    comment_lines = len(single_line_comments) + sum(comment.count('\n') + 1 for comment in multi_line_comments)

    total_chars = len(source_code)
    total_lines = source_code.count('\n') + 1

    comment_chars_ratio = comment_chars / total_chars
    comment_lines_ratio = comment_lines / total_lines
    return comment_chars_ratio, comment_lines_ratio

def decompress_cpp_code(code):
    formatted = ""
    indent_level = 0
    for c in code:
        if c == '{':
            formatted += c + '\n' + '    ' * (indent_level + 1)
            indent_level += 1
        elif c == '}':
            indent_level -= 1
            formatted = formatted[:-4]
            formatted += '\n' + '    ' * indent_level + c
        elif c == ';':
            formatted += c + '\n' + '    ' * indent_level
        elif c == '\n':
            pass
        else:
            formatted += c
    return formatted
