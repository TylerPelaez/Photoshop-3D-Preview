/************************************************************************
 * Copyright 2022 Adobe
 * All Rights Reserved.
 *
 * NOTICE: Adobe permits you to use, modify, and distribute this file in
 * accordance with the terms of the Adobe license agreement accompanying
 * it.
 *************************************************************************
 */

#include <exception>
#include <stdexcept>
#include <string>
#include <chrono>
#include <iostream>
#include <fstream>
#include <unordered_map>

#include "./utilities/UxpAddon.h"
#include "./utilities/UxpTask.h"
#include "./utilities/UxpValue.h"


std::ofstream logger;

long long GetCurrentTimeMillis() {
    auto now = std::chrono::system_clock::now();
    auto duration = now.time_since_epoch();
    return std::chrono::duration_cast<std::chrono::milliseconds>(duration).count();
}

void LogError(std::string msg) {
    logger << "ERROR: " << msg << std::endl;
}

void LogTiming(std::string msg) {
    logger << msg << ": " << GetCurrentTimeMillis() << std::endl;
}

void LogTask(std::string msg, size_t task_id) {
    logger << task_id << ": " << msg << std::endl;
}

void LogTaskTiming(std::string msg, size_t task_id) {
    LogTiming("Task " + std::to_string(task_id) + ": " + msg);
}


namespace {
    std::unordered_map< int64_t, std::unique_ptr<std::vector<char16_t> > > document_id_to_pixel_array;


class TaskParams {
public:
    uint8_t* pixel_data;
    int64_t document_id;

    int64_t components;
    bool is_chunky;

    int64_t batch_pixel_offset;
    int64_t batch_pixel_size;
    
    size_t pixel_data_byte_length;
};

addon_value ConvertBatchToString(addon_env env, const TaskParams& params);


addon_value CloseDocument(addon_env env, addon_callback_info info) {
    size_t argc = 1;
    addon_value args[1];

    Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, args, nullptr, nullptr));

    int64_t document_id;

    Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[0], &document_id));

    document_id_to_pixel_array.erase(document_id);
}




addon_value ConvertToString(addon_env env, addon_callback_info info) {
    LogTiming("ConvertToString Entry");
    try {

        // 4 Arguments are expected: Width, height, Image Data component count, and the pixel data as a UInt8Array
        size_t argc = 6;
        addon_value args[6];
        
        Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, args, nullptr, nullptr));

        TaskParams params = TaskParams();

        Check(UxpAddonApis.uxp_addon_get_arraybuffer_info(env, args[0], (void**)&params.pixel_data, &params.pixel_data_byte_length));

        //LogTiming("Copy Speed Begin");

        //auto new_pixel_data = std::make_shared<std::vector<int8_t>>();

        //new_pixel_data.get()->insert(new_pixel_data.get()->end(), &params.pixel_data[0], &params.pixel_data[params.pixel_data_byte_length]);

        //LogTiming("Copy Speed End");


        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[1], &params.document_id));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[2], &params.components));
        Check(UxpAddonApis.uxp_addon_get_value_bool(env, args[3], &params.is_chunky));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[4], &params.batch_pixel_offset));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[5], &params.batch_pixel_size));


        return ConvertBatchToString(env, params);
    }
    catch (const std::exception& exc)
    {
        return GetErrorMessage(env, exc.what());
    }
    catch (...) {
        return CreateErrorFromException(env);
    }
}

addon_value ConvertBatchToString(addon_env env, const TaskParams& p) {
    try {
        //LogTaskTiming("Start", p.document_id);

        size_t plane_size = p.pixel_data_byte_length / p.components;


        // A change in size suggests the client changed the texture resolution. create new data.
        if (document_id_to_pixel_array.find(p.document_id) == document_id_to_pixel_array.end() || document_id_to_pixel_array[p.document_id].get()->size() != plane_size * 4) {
            // Assign 0 as default to all values.... this will be slow the first time it happens most likely :)
            document_id_to_pixel_array[p.document_id] = std::make_unique<std::vector<char16_t>>(plane_size * 4, 0); 
        }

        size_t length = p.batch_pixel_size * 4;

        std::vector<char16_t>& data = *(document_id_to_pixel_array[p.document_id].get());

        char16_t* modified_pixel_data = &(data[p.batch_pixel_offset * 4]);

        bool changed = false;

        if (p.is_chunky) {
            size_t beginning = p.batch_pixel_offset * p.components;

            if (p.components == 4) {

                for (size_t i = beginning; i < beginning + length; i++) {
                    const char16_t& val = p.pixel_data[i];
                    if (changed || modified_pixel_data[i] != val) {
                        modified_pixel_data[i] = val;
                        changed = true;
                    }
                }
            } else {
                size_t current_pixel_index = 0;
                size_t rgba_index;
                for (size_t i = beginning; i < beginning + (p.batch_pixel_size * 3); i++) {
                    rgba_index = current_pixel_index + (i % 3);

                    const char16_t& val = p.pixel_data[i];
                    if (changed || modified_pixel_data[rgba_index] != val) {
                        modified_pixel_data[rgba_index] = val;
                        changed = true;
                    }
                    if (i % 3 == 2 && i != 0) {
                        modified_pixel_data[rgba_index + 1] = 255;
                        current_pixel_index += 4;
                    }
                }
            }
        } else {
            // this is the common case. PS files are usually stored in planar fashion.
            for (int component = 0; component < 4; component++) {
                size_t batch_start_index = (plane_size * component) + p.batch_pixel_offset;
                size_t batch_end_index = batch_start_index + p.batch_pixel_size;

                size_t pixel_position = 0;

                // Force alpha = 255 for every pixel when ps only sends us 3 components
                if (p.components <= component) {
                    for (size_t i = batch_start_index; i < batch_end_index; i++ ) {
                        modified_pixel_data[pixel_position * 4 + component] = 255;
                        pixel_position++;
                    }
                } else {
                    for (size_t i = batch_start_index; i < batch_end_index; i++ ) {
                        const size_t& index = pixel_position * 4 + component;
                        const char16_t& val = p.pixel_data[i];

                        if (changed || modified_pixel_data[index] != val) {
                            modified_pixel_data[index] = val;
                            changed = true;
                        }
                        pixel_position++;
                    }
                }
            }
        }

        //LogTaskTiming("Conversion Done", p.document_id);
        if (!changed) {
            addon_value result;
            Check(UxpAddonApis.uxp_addon_get_undefined(env, &result));

            return result; // We changed nothing, don't submit an update...
        }
        else {
            addon_value result;
            Check(UxpAddonApis.uxp_addon_create_string_utf16(env, modified_pixel_data, length, &result));

            //LogTaskTiming("Complete", p.document_id);

            logger.flush();

            return result;
        }
    } catch(const std::exception& exc) {
        LogError(exc.what());

    } catch(...) {
        LogError("Unknown Exception");
    }
}

/* Method invoked when the addon module is being requested by JavaScript
 * This method is invoked on the JavaScript thread.
 */
addon_value Init(addon_env env, addon_value exports, const addon_apis& addonAPIs) {
    logger.open("C:\\Users\\nrdft\\AppData\\Roaming\\Adobe\\Adobe Photoshop 2024\\Logs\\logfile.txt", std::ios::app);
    
    LogTiming("Init");
    document_id_to_pixel_array = std::unordered_map<int64_t, std::unique_ptr<std::vector<char16_t> > >();

    addon_status status = addon_ok;
    addon_value fn = nullptr;

    {
        status = addonAPIs.uxp_addon_create_function(env, NULL, 0, ConvertToString, NULL, &fn);
        if (status != addon_ok) {
            addonAPIs.uxp_addon_throw_error(env, NULL, "Unable to wrap native function");
        }

        status = addonAPIs.uxp_addon_set_named_property(env, exports, "convert_to_string", fn);
        if (status != addon_ok) {
            addonAPIs.uxp_addon_throw_error(env, NULL, "Unable to populate exports");
        }
    }
    return exports;
}

}  // namespace

/*
 * Register initialization routine
 * Invoked by UXP during uxpaddon load.
 */
UXP_ADDON_INIT(Init)

void terminate(addon_env env) {
    try {
        logger.flush();
        logger.close();
    } catch (...) {
    }
}

/* Register addon termination routine
 * Invoked by UXP during uxpaddon un-load.
 */
UXP_ADDON_TERMINATE(terminate)
