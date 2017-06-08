/*
 * Copyright 2011 eBay Software Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
/**
* Module to manage the lifecycle of widgets
*
*/
'use strict';

var raptorRenderer = require('raptor-renderer');
var warp10 = require('warp10');
var isObjectEmpty = require('raptor-util/isObjectEmpty');
var WidgetsContext = require('./WidgetsContext');

var WARP10_STATE_SERIALIZATION_OPTIONS = {var: '$markoWidgetsState', additive: true};
var WARP10_CONFIG_SERIALIZATION_OPTIONS = {var: '$markoWidgetsConfig', additive: true};
var TAG_START = '<noscript id="markoWidgets" data-ids="';
var TAG_END = '"></noscript>';


function WrappedString(val) {
    this.html = val;
}

WrappedString.prototype = {
    toString: function() {
        return this.html;
    }
};

exports.WidgetsContext = WidgetsContext;
exports.getWidgetsContext = WidgetsContext.getWidgetsContext;
exports.uniqueId = require('./uniqueId');
exports.attrs = function(widgetDef) {
    if (!widgetDef.type) {
        return null;
    }

    var attrs = {
        'data-widget': widgetDef.type
    };

    var hasDomEvents = widgetDef.hasDomEvents;
    if (hasDomEvents) {
        attrs['data-w-on'] = '1';
    }

    var customEvents = widgetDef.customEvents;
    if (customEvents) {
        attrs['data-w-events'] = widgetDef.scope + ',' + customEvents.join(',');
    }

    var extend = widgetDef.extend;

    if (extend && extend.length) {
        attrs['data-w-extend'] = new WrappedString(extend.join(','));
    }

    var bodyElId = widgetDef.bodyElId;
    if (bodyElId != null) {
        attrs['data-w-body'] = bodyElId === '' ? true : bodyElId;
    }

    return attrs;
};
exports.writeDomEventsEl = function(widgetDef, out) {
    var domEvents = widgetDef.domEvents;
    if (domEvents) {
        out.write('<span id="' + widgetDef.elId('$on') + '" data-on="' + domEvents.join(',') + '"></span>');
    }
};

exports.writeInitWidgetsCode = function(out, options, widgetsContext) {
    var clearWidgets = true;
    var scanDOM = false;
    var immediate = false;

    if (options) {
        clearWidgets = options.clearWidgets !== false;
        scanDOM = options.scanDOM === true;
        immediate = options.immediate === true;
    }


    if (scanDOM) {
        out.write(TAG_START + '*' + TAG_END);
    } else {
        var rootWidgetDefs;
        var rootWidgetDef;

        if (widgetsContext) {
            rootWidgetDef = widgetsContext.widgetStack[0];
            if (!rootWidgetDef.children || !rootWidgetDef.children.length) {
                return;
            }
        } else {
            var globalWidgetsContext = out.global.widgets;
            if (!globalWidgetsContext) {
                return;
            }

            rootWidgetDefs = globalWidgetsContext.widgets;
            if (!rootWidgetDefs || !rootWidgetDefs.length) {
                return;
            }
        }

        var ids = '';

        var commaRequired = false;
        var writeWidgets;

        // Build separate objects for storing widget state and widget config. These objects
        // will be serialized and sent to the browser using warp10
        var widgetStateStore = {};
        var widgetConfigStore = {};

        var writeWidget = function(widget) {

            if (widget.children.length) {
                // Depth-first search (children should be initialized before parent)
                writeWidgets(widget.children);
                widget.children = [];
            }

            if (commaRequired) {
                ids += ',';
            } else {
                commaRequired = true;
            }

            var widgetConfig = widget.config;
            if (widgetConfig) {
                // Put the widget config in the store using the widget ID as the key
                widgetConfigStore[widget.id] = widgetConfig;
            }

            var widgetState = widget.state;
            if (widgetState) {
                // Put the widget state in the store using the widget ID as the key
                widgetStateStore[widget.id] = widgetState;
            }

            ids += widget.id;
        };

        writeWidgets = function(widgets) {
            for (var i = 0, len = widgets.length; i < len; i++) {
                writeWidget(widgets[i]);
            }
        };

        if (rootWidgetDefs) {
            writeWidgets(rootWidgetDefs);
        } else {
            writeWidgets(rootWidgetDef.children);
            rootWidgetDef.children = [];
        }

        var widgetStateDeserializationCode;
        var widgetConfigDeserializationCode;

        if (isObjectEmpty(widgetStateStore)) {
            widgetStateDeserializationCode = '';
        } else {
            widgetStateDeserializationCode = warp10.serialize(widgetStateStore, WARP10_STATE_SERIALIZATION_OPTIONS) +
                    ';\n';
        }

        if (isObjectEmpty(widgetConfigStore)) {
            widgetConfigDeserializationCode = '';
        } else {
            widgetConfigDeserializationCode = warp10.serialize(widgetConfigStore,WARP10_CONFIG_SERIALIZATION_OPTIONS) +
                    ';\n';
        }

        var cspNonce = out.global.cspNonce;
        var nonceAttr = cspNonce ? ' nonce='+JSON.stringify(cspNonce) : '';

        if (immediate) {
            out.write('<script' + nonceAttr + '>' +
                widgetStateDeserializationCode +
                widgetConfigDeserializationCode +
                '$markoWidgets("' + ids + '")</script>');
        } else {
            out.write('<script' + nonceAttr + '>' +
                widgetStateDeserializationCode +
                widgetConfigDeserializationCode +
                '</script>');

            out.write(TAG_START + ids + TAG_END);
        }
    }
};


function getRenderedWidgets(out) {
    var globalWidgetsContext = out.global.widgets;

    if (!globalWidgetsContext) {
        return { ids: '' };
    }

    var rootWidgetDefs = globalWidgetsContext.widgets;

    if (!rootWidgetDefs || !rootWidgetDefs.length) {
        return { ids: '' };
    }

    var ids = '';

    var commaRequired = false;

    var widgetStateStore = {};
    var widgetConfigStore = {};

    function addWidget(widget) {

        if (widget.children.length) {
            // Depth-first search (children should be initialized before parent)
            addWidgets(widget.children);
            widget.children = [];
        }

        if (commaRequired) {
            ids += ',';
        } else {
            commaRequired = true;
        }

        var widgetConfig = widget.config;
        if (widgetConfig) {
            widgetConfigStore[widget.id] = widgetConfig;
        }

        var widgetState = widget.state;
        if (widgetState) {
            widgetStateStore[widget.id] = widgetState;
        }

        ids += widget.id;
    }

    function addWidgets(widgets) {
        for (var i = 0, len = widgets.length; i < len; i++) {
            addWidget(widgets[i]);
        }
    }

    addWidgets(rootWidgetDefs);

    return {
        ids: ids,
        state: widgetStateStore,
        config: widgetConfigStore
    };
}


exports.getInitWidgetsCode = function(widgetsContext) {
    var renderedWidgets = getRenderedWidgets(widgetsContext);
    var ids = renderedWidgets.ids;
    var state = renderedWidgets.state;
    var config = renderedWidgets.config;

    var code = '';

    if (!isObjectEmpty(state)) {
        code += warp10.serialize(
                state,
                WARP10_STATE_SERIALIZATION_OPTIONS) +
                ';\n';
    }

    if (!isObjectEmpty(config)) {
        code += warp10.serialize(
                config,
                WARP10_CONFIG_SERIALIZATION_OPTIONS) +
                ';\n';
    }

    code += '$markoWidgets("' + ids + '");';
    return code;
};


/**
 * Returns an object that can be sent to the browser using JSON.stringify. The parsed object should be
 * passed to require('marko-widgets').initWidgets(...);
 *
 * @param  {WidgetsContext|AsyncWriter} widgetsContext A WidgetsContext or an AsyncWriter
 * @return {Object} An object with information about the rendered widgets that can be serialized to JSON. The object should be treated as opaque
 */
exports.getRenderedWidgets = exports.getRenderedWidgetIds /* deprecated */ = function(widgetsContext) {
    var renderedWidgets = getRenderedWidgets(widgetsContext);
    var ids = renderedWidgets.ids;
    var state = renderedWidgets.state;
    var config = renderedWidgets.config;

    var result = {
        ids: ids
    };

    // NOTE: Calling warp10.stringifyPrepare(obj) will produce a new object that is safe to serializing using
    //       JSON.stringify(). The deserialized/parsed object will need to be converted to the final object using
    //       warp10.finalize(obj)
    if (!isObjectEmpty(state)) {
        result.state = warp10.stringifyPrepare(state);
    }

    if (!isObjectEmpty(config)) {
        result.config = warp10.stringifyPrepare(config);
    }

    return result;
};

exports.makeRenderable = exports.renderable = function(target, renderer) {
    target.renderer = renderer;
    target.render = function(data, callback) {
        if(!callback) {
            require('./deprecate').warn(
                'Calling `render` synchronously is deprecated. '+
                'Use `renderSync` instead.'
            );
            return raptorRenderer.render(renderer, data);
        }

        raptorRenderer.render(renderer, data, callback);
    };
    target.renderSync = function(data) {
        return raptorRenderer.render(renderer, data);
    };
};
exports.render = raptorRenderer.render;

exports.defineComponent = require('./defineComponent');
exports.defineWidget = require('./defineWidget');
exports.defineRenderer = require('./defineRenderer');

// registerWidget is a no-op on the server.
// Fixes https://github.com/marko-js/marko-widgets/issues/111
exports.registerWidget = function() {};
