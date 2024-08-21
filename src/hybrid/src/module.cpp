#include <exception>
#include <stdexcept>
#include <string>
#include <memory>
#include <unordered_map>

#include "./utilities/UxpAddon.h"

namespace {
    std::unordered_map< int64_t, std::unique_ptr<std::vector<char16_t> > > document_id_to_pixel_array; // image data cache


/**
 * Helper data structure for function parameters
 */
class TaskParams {
public:
    uint8_t* pixel_data;
    int64_t document_id;

    int64_t components;
    bool is_chunky;

    int64_t batch_pixel_offset;
    int64_t batch_pixel_size;
    
    bool force_full_update;

    size_t pixel_data_byte_length;
};

addon_value ConvertBatchToString(addon_env env, const TaskParams& params);

/**
 * Clear the image data cache entry for the given document. This is invoked on the javascript thread.
 */
addon_value CloseDocument(addon_env env, addon_callback_info info) {
    try {
    
        size_t argc = 1;
        addon_value args[1];

        Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, args, nullptr, nullptr));

        int64_t document_id;

        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[0], &document_id));

        document_id_to_pixel_array.erase(document_id);

        addon_value result;
        Check(UxpAddonApis.uxp_addon_get_undefined(env, &result));

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

/**
 * Entrypoint for UXP caller, read args and pass on to ConvertBatchToString for processing.
 */
addon_value ConvertToString(addon_env env, addon_callback_info info) {
    try {
        size_t argc = 7;
        addon_value args[7];
        
        Check(UxpAddonApis.uxp_addon_get_cb_info(env, info, &argc, args, nullptr, nullptr));

        TaskParams params = TaskParams();

        Check(UxpAddonApis.uxp_addon_get_arraybuffer_info(env, args[0], (void**)&params.pixel_data, &params.pixel_data_byte_length));


        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[1], &params.document_id));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[2], &params.components));
        Check(UxpAddonApis.uxp_addon_get_value_bool(env, args[3], &params.is_chunky));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[4], &params.batch_pixel_offset));
        Check(UxpAddonApis.uxp_addon_get_value_int64(env, args[5], &params.batch_pixel_size));
        Check(UxpAddonApis.uxp_addon_get_value_bool(env, args[6], &params.force_full_update));


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

/**
 * Convert the 0-255 integral pixel data in either Planar (RRRGGGBBBAAA) or Chunky (RGBARGBARGBA) format to
 * a UTF-16 string containing the charCodes matching the given pixel data in Chunky format. Can be supplied an offset + batch size in params.
 * Regardless of whether pixel data is RGB or RGBA format, the response string will be in RGBA format.
 * 
 * The pixel data is read into a cache, and this function will return a value of undefined to the javascript caller 
 * if the data in the given batch is unchanged from the existing cached data. 
 */
addon_value ConvertBatchToString(addon_env env, const TaskParams& p) {
    // In PS Planar format, each "plane" consists of the pixel data in the entire document of an RGB(A) component.
    // The plane size is just how many pixels in the batch each component should take up.  
    size_t plane_size = p.pixel_data_byte_length / p.components;


    // Either this is a new documnet or the client changed the texture resolution. Set the cache data to default of all 0 values.
    if (document_id_to_pixel_array.find(p.document_id) == document_id_to_pixel_array.end() || document_id_to_pixel_array[p.document_id].get()->size() != plane_size * 4) {
        document_id_to_pixel_array[p.document_id] = std::make_unique<std::vector<char16_t>>(plane_size * 4, 0); 
    }

    // Regardless of input data, the response must 
    size_t length = p.batch_pixel_size * 4;

    std::vector<char16_t>& data = *(document_id_to_pixel_array[p.document_id].get());

    // Create a pointer to the cached data at the given offset
    char16_t* modified_pixel_data = &(data[p.batch_pixel_offset * 4]);

    // Whether the pixel data in the batch is different from the cached data.
    // If force full update is enabled, then always assume pixels have been changed to make this cache-busting and force sending to the webview
    bool changed = p.force_full_update;

    if (p.is_chunky) {
        // When data is already chunky, we only need to check for cache-changes and insert 255 for the alpha component if we don't have one.
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
        // This is the common case. PS files are usually stored in planar fashion.
        // We just need to do the annoying conversion from planar to chunky format before doing our cache check and insertion into the result.
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

    if (!changed) {
        addon_value result;
        Check(UxpAddonApis.uxp_addon_get_undefined(env, &result));

        return result; // We changed nothing, don't submit an update...
    }
    else {
        addon_value result;

        // This copies the buffer into the result var and will show up in js as a string.
        Check(UxpAddonApis.uxp_addon_create_string_utf16(env, modified_pixel_data, length, &result));
        return result;
    }
}

/** 
* Method invoked when the addon module is being requested by javascript. Declare the functions so they can be called in JS.
 */
addon_value Init(addon_env env, addon_value exports, const addon_apis& addonAPIs) {
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

    {
        status = addonAPIs.uxp_addon_create_function(env, NULL, 0, CloseDocument, NULL, &fn);
        if (status != addon_ok) {
            addonAPIs.uxp_addon_throw_error(env, NULL, "Unable to wrap native function");
        }

        status = addonAPIs.uxp_addon_set_named_property(env, exports, "close_document", fn);
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
