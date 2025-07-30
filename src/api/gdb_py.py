import gdb
import os
import json

def parse_variables(var):
    type_code = var.type.code

    match type_code:
        case gdb.TYPE_CODE_ARRAY:
            output_var = []

            array_size = var.type.range()[1] + 1
            if array_size == 1:
                return gdb.Value.format_string(var[0])
            for i in range(array_size):
                sub_var = var[i]
                output_var.append(parse_variables(sub_var))
            
            return output_var

        case gdb.TYPE_CODE_STRUCT:
            output_var = {}

            for field in var.type.fields():
                output_var[field.name] = parse_variables(var[field.name])
            
            return output_var
        
        case _:
            output_var = gdb.Value.format_string(var)
            return output_var

json_data = {}
steps = []
key = 0

gdb.execute("set logging enabled off")

gdb.execute("set logging file gdb_debug.log")
gdb.execute("set logging redirect on")
gdb.execute("set logging debugredirect on")

gdb.execute("set logging enabled on")

gdb.execute("set confirm off")
gdb.execute("set pagination off")
gdb.execute("set verbose off")

gdb.execute("break main")
gdb.execute("run < public/Code/textInput.txt")

#include_path = os.path.split(os.path.realpath(__file__))[0].replace('\\','/')+"/mingw64/lib/gcc/x86_64-w64-mingw32/14.2.0/include/c++/"
include_path1 = "./mingw64/lib/gcc/x86_64-w64-mingw32/14.2.0/include/"
include_path2 = "./mingw64/x86_64-w64-mingw32/include/"
gdb.execute(rf"skip -gfi {include_path1}*")
gdb.execute(rf"skip -gfi {include_path1}*/*")
gdb.execute(rf"skip -gfi {include_path1}*/*/*")

gdb.execute(rf"skip -gfi {include_path2}*")
gdb.execute(rf"skip -gfi {include_path2}*/*")
gdb.execute(rf"skip -gfi {include_path2}*/*/*")


while True:
    try:
        step = {}
        step['key'] = key
        key = key + 1
        if not gdb.inferiors()[0].is_valid():
            break
        
        frame = gdb.selected_frame()
        sal = frame.find_sal()
        if sal:
            step['line_number'] = sal.line

        functions = []
        
        while frame:
            tmp_func = {}

            tmp_func['function_name'] = frame.name()
            tmp_func['values'] = []

            block = frame.block()
            for symbol in block:
                if symbol.is_variable:
                    try:
                        var_name = symbol.name

                        var_value = frame.read_var(symbol)
                        tmp_value = {}
                        tmp_value['value'] = parse_variables(var_value)
                        
                        tmp_value['name'] = var_name
                        tmp_value['type'] = var_value.type.name
                        tmp_value['address'] = gdb.Value.format_string(var_value.address)

                        tmp_func['values'].append(tmp_value)
                    except:
                        pass
                
            functions.append(tmp_func)
            frame = frame.older()

        step['functions'] = functions

        steps.append(step)

        gdb.execute("step",to_string=True)

    except:
        break
        

gdb.execute("set logging enabled off")

print("<gdb_debug_complete>")

json_data['steps'] = steps

print(json.dumps(json_data))

