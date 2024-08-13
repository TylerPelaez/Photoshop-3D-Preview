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

#include "./cpp/utilities/UxpAddon.h"
#include "./cpp/utilities/UxpTask.h"
#include "./cpp/utilities/UxpValue.h"

namespace {
addon_value ConvertToString(addon_env env, addon_callback_info info) {
    try {
        // 4 Arguments are expected: Width, height, Image Data component count, and the pixel data as a UInt8Array
        size_t argc = 4;
        addon_value args[4];
        
        Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, args, nullptr, nullptr));


        int64_t width;
        int64_t height;
        int64_t components;

        uint8_t* pixel_data;
        size_t byte_length;

        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[0], &width));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[1], &height));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[2], &components));

        bool is_array_buffer;

        Check(UxpAddonApis.uxp_addon_is_arraybuffer(env, args[3], &is_array_buffer));



        Check(UxpAddonApis.uxp_addon_get_arraybuffer_info(env, args[3], (void**)&pixel_data, &byte_length));

        size_t length = 4 * width * height;

        char16_t* modified_pixel_data; 

        modified_pixel_data = new char16_t[length];

        if (components == 4) {
            for (int i = 0; i < length; i++) {
                modified_pixel_data[i] = pixel_data[i];
            }
        }
        else {
            size_t current_pixel_index = 0;
            size_t rgba_index;
            for (int i = 0; i < byte_length; i++) {
                rgba_index = current_pixel_index + (i % 3);


                // THREE.js no longer supports RGBFormatted data, so we need to insert a bunch of full alpha values...
                modified_pixel_data[rgba_index] = pixel_data[i];
                if (i % 3 == 2 && i != 0) {
                    modified_pixel_data[rgba_index + 1] = 255;
                    current_pixel_index += 4;
                }
            }

        }



        addon_value result;
        Check(UxpAddonApis.uxp_addon_create_string_utf16(env, modified_pixel_data, length, &result));


        //addon_ref ref;
        //// For deallocating the memory for gc to cleanup (presumably after js is done with it, I Think???
        //Check(UxpAddonApis.uxp_addon_create_reference(env, (addon_value)modified_pixel_data, 0, &ref));


        return result;
    }
    catch (const std::exception& exc)
    {
        return GetErrorMessage(env, exc.what());
    }
    catch (...) {
        return CreateErrorFromException(env);
    }
}




/* Method invoked when the addon module is being requested by JavaScript
 * This method is invoked on the JavaScript thread.
 */
addon_value Init(addon_env env, addon_value exports, const addon_apis& addonAPIs) {
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
    } catch (...) {
    }
}

/* Register addon termination routine
 * Invoked by UXP during uxpaddon un-load.
 */
UXP_ADDON_TERMINATE(terminate)
