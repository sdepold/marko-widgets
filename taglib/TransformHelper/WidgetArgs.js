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
'use strict';

var getRequirePath = require('../getRequirePath');

var WidgetArgs = function () {
    this.id = null;
    this.customEvents = null;
    this.extend = null;
    this.extendConfig = null;
    this.extendState = null;

    this.empty = true;
};

WidgetArgs.prototype.etId = function (id) {
    this.empty = false;

    this.id = id;
};

WidgetArgs.prototype.getId = function () {
    return this.id;
};

WidgetArgs.prototype.addCustomEvent = function (eventType, targetMethod) {
    this.empty = false;

    if (!this.customEvents) {
        this.customEvents = [];
    }

    this.customEvents.push(eventType);
    this.customEvents.push(targetMethod);
};

WidgetArgs.prototype.etExtend = function (extendType, extendConfig, extendState) {
    this.empty = false;

    this.extend = extendType;
    this.extendConfig = extendConfig;
    this.extendState = extendState;
};

WidgetArgs.prototype.compile = function (transformHelper) {
    if (this.empty) {
        return;
    }

    var el = transformHelper.el;

    var widgetArgsFunctionCall = this.buildWidgetArgsFunctionCall(transformHelper);
    var cleanupWidgetArgsFunctionCall = this.buildCleanupWidgetArgsFunctionCall(transformHelper);

    el.onBeforeGenerateCode(function (event) {
        event.insertCode(widgetArgsFunctionCall);
    });

    el.onAfterGenerateCode(function (event) {
        event.insertCode(cleanupWidgetArgsFunctionCall);
    });
};

WidgetArgs.prototype.buildWidgetArgsFunctionCall = function (transformHelper) {
    var context = transformHelper.context;
    var builder = transformHelper.builder;

    var id = this.id;
    var customEvents = this.customEvents;
    var extend = this.extend;
    var extendConfig = this.extendConfig;
    var extendState = this.extendState;

    // Make sure the nested widget has access to the ID of the containing
    // widget if it is needed
    var shouldProvideScope = id || customEvents;

    var widgetArgsVar = context.addStaticVar('__widgetArgs',
        'require("' + getRequirePath('marko-widgets/taglib/helpers/widgetArgs', context) + '")');

    var functionCallArgs = [
        builder.identifier('out')
    ];

    if (shouldProvideScope) {
        functionCallArgs.push(builder.memberExpression(
            builder.identifier('widget'),
            builder.identifier('id')
        ));
    } else {
        functionCallArgs.push(builder.literalNull());
    }

    if (id != null) {
        functionCallArgs.push(id);
    } else {
        functionCallArgs.push(builder.literalNull());
    }

    if (customEvents) {
        functionCallArgs.push(builder.literal(customEvents));
    }

    if (extend) {
        if (!customEvents) {
            functionCallArgs.push(builder.literalNull());
        }

        functionCallArgs.push(extend);
        functionCallArgs.push(extendConfig || builder.literalNull());
        functionCallArgs.push(extendState || builder.literalNull());
    }
    return builder.functionCall(widgetArgsVar, functionCallArgs);
};

WidgetArgs.prototype.buildCleanupWidgetArgsFunctionCall = function (transformHelper) {
    var context = transformHelper.context;
    var builder = transformHelper.builder;

    var cleanupWidgetArgsVar = context.addStaticVar('_cleanupWidgetArgs',
        '__widgetArgs.cleanup');

    return builder.functionCall(cleanupWidgetArgsVar, [builder.identifierOut()]);
};

module.exports = WidgetArgs;
