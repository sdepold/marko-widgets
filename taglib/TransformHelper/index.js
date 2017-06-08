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

var tryRequire = require('try-require');
var fs = tryRequire('fs', require);
var nodePath = require('path');
var WidgetArgs = require('./WidgetArgs');
var getRequirePath = require('../getRequirePath');
var buildWidgetTypeNode = require('../util/buildWidgetTypeNode');

var TransformHelper = function (el, context) {
    this.el = el;
    this.context = context;
    this.builder = context.builder;
    this.dirname = context.dirname;

    this.widgetNextElId = 0;
    this.widgetIdInfo = undefined;
    this.widgetArgs = undefined;
    this.containingWidgetNode = undefined;
    this._markoWidgetsVar = undefined;
    this.widgetStack = context.data.widgetStack || (context.data.widgetStack = []);
};

TransformHelper.prototype.addError = function (message, code) {
    this.context.addError(this.el, message, code);
};

TransformHelper.prototype.getWidgetArgs = function () {
    return this.widgetArgs || (this.widgetArgs = new WidgetArgs());
};

TransformHelper.prototype.nextUniqueId = function () {
    var widgetNextElId = this.context.data.widgetNextElId;
    if (widgetNextElId == null) {
        this.context.data.widgetNextElId = 0;
    }

    return (this.context.data.widgetNextElId++);
};

TransformHelper.prototype.getNestedIdExpression = function () {
    this.assignWidgetId();
    return this.getWidgetIdInfo().nestedIdExpression;
};

TransformHelper.prototype.getIdExpression = function () {
    this.assignWidgetId();
    return this.getWidgetIdInfo().idExpression;
};

TransformHelper.prototype.getWidgetIdInfo = function () {
    return this.widgetIdInfo;
};

TransformHelper.prototype.getDefaultWidgetModule = function () {
    var dirname = this.dirname;
    if (fs.existsSync(nodePath.join(dirname, 'widget.js'))) {
        return './widget';
    } else if (fs.existsSync(nodePath.join(dirname, 'index.js'))) {
        return './';
    } else {
        return null;
    }
};

TransformHelper.prototype.getMarkoWidgetsRequirePath = function (target) {
    return getRequirePath(target, this.context);
};

TransformHelper.prototype.markoWidgetsVar = function () {
    if (!this._markoWidgetsVar) {
        this._markoWidgetsVar = this.context.importModule('__markoWidgets', this.getMarkoWidgetsRequirePath('marko-widgets'));
    }

    return this._markoWidgetsVar;
};

TransformHelper.prototype.buildWidgetElIdFunctionCall = function (id) {
    var builder = this.builder;

    var widgetElId = builder.memberExpression(
        builder.identifier('widget'),
        builder.identifier('elId'));

    return builder.functionCall(widgetElId, arguments.length === 0 ? [] : [ id ]);
};

TransformHelper.prototype.buildWidgetTypeNode = function (path) {
    return buildWidgetTypeNode(path, this.dirname, this.builder);
};

TransformHelper.prototype.assignWidgetId = require('./assignWidgetId');
TransformHelper.prototype.getContainingWidgetNode = require('./getContainingWidgetNode');
TransformHelper.prototype.handleWidgetEvents = require('./handleWidgetEvents');
TransformHelper.prototype.handleWidgetPreserve = require('./handleWidgetPreserve');
TransformHelper.prototype.handleWidgetPreserveAttrs = require('./handleWidgetPreserveAttrs');
TransformHelper.prototype.handleWidgetBody = require('./handleWidgetBody');
TransformHelper.prototype.handleWidgetBind = require('./handleWidgetBind');
TransformHelper.prototype.handleWidgetExtend = require('./handleWidgetExtend');
TransformHelper.prototype.handleWidgetFor = require('./handleWidgetFor');

module.exports = TransformHelper;
