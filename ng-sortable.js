/**
 * @author RubaXa <trash@rubaxa.org>
 * @licence MIT
 */
(function (factory) {
	'use strict';

	if (typeof define === 'function' && define.amd) {
		define(['angular', './Sortable'], factory);
	}
	else if (typeof require === 'function' && typeof exports === 'object' && typeof module === 'object') {
		require('angular');
		factory(angular, require('./Sortable'));
		module.exports = 'ng-sortable';
	}
	else if (window.angular && window.Sortable) {
		factory(angular, Sortable);
	}
})(function (angular, Sortable) {
	'use strict';


	/**
	 * @typedef   {Object}        ngSortEvent
	 * @property  {*}             model      List item
	 * @property  {Object|Array}  models     List of items
	 * @property  {number}        oldIndex   before sort
	 * @property  {number}        newIndex   after sort
	 */

	var expando = 'Sortable:ng-sortable';

	angular.module('ng-sortable', [])
		.constant('ngSortableVersion', '0.4.1')
		.constant('ngSortableConfig', {})
		.directive('ngSortable', ['$parse', '$timeout', 'ngSortableConfig', function ($parse, $timeout, ngSortableConfig) {
			var removed,
				nextSibling;

			function getNgRepeatExpression(node) {
				return node.getAttribute('ng-repeat') || node.getAttribute('data-ng-repeat') || node.getAttribute('x-ng-repeat');
			}

			// Export
			return {
				restrict: 'AC',
				scope: {ngSortable: "=?"},
				priority: 1001,
				compile: function ($element, $attr) {

					var ngRepeat = [].filter.call($element[0].childNodes, function (node) {
						return node.nodeType === Node.ELEMENT_NODE && getNgRepeatExpression(node);
					})[0];

					if (!ngRepeat) {
						return;
					}

					var match = getNgRepeatExpression(ngRepeat)
						.match(/^\s*([\s\S]+?)\s+in\s+([\s\S]+?)(?:\s+as\s+([\s\S]+?))?(?:\s+track\s+by\s+([\s\S]+?))?\s*$/);

					if (!match) {
						return;
					}

					var rhs = match[2];

					return function postLink(scope, $el) {
						var itemsExpr = $parse(rhs);
						var getSource = function getSource() {
							return itemsExpr(scope.$parent) || [];
						};


						var el = $el[0],
							options = angular.extend(scope.ngSortable || {}, ngSortableConfig),
							watchers = [],
							offDestroy,
							sortable
						;

						el[expando] = getSource;

						var troops = null,
							troopTimeout = null;

						function _emitEvent(/**Event*/evt, /*Mixed*/item, /*type*/ name) {
							$timeout.cancel(troopTimeout);

							name = name || 'on' + evt.type.charAt(0).toUpperCase() + evt.type.substr(1);
							var source = getSource();

							switch (evt.type) {
							case 'leave':
								troopTimeout = $timeout(function () {
									troops = source[evt.oldIndex];
								}, 10, false);
								break;
							case 'over':
								troops = null;
								break;
							}

							/* jshint expr:true */
							options[name] && options[name]({
								model: item || source[evt.newIndex],
								models: source,
								oldIndex: evt.oldIndex,
								newIndex: evt.newIndex,
								originalEvent: evt,
								troops: troops
							});
						}

						function _sync(/**Event*/evt) {
							var items = getSource();

							if (!items) {
								// Without ng-repeat
								return;
							}

							var oldIndex = evt.oldIndex,
								newIndex = evt.newIndex;

							if (el !== evt.from) {
								var prevItems = evt.from[expando]();

								removed = prevItems[oldIndex];

								if (evt.clone) {
									removed = angular.copy(removed);
									prevItems.splice(Sortable.utils.index(evt.clone, sortable.options.draggable), 0, prevItems.splice(oldIndex, 1)[0]);
									evt.from.removeChild(evt.clone);
								}
								else {
									prevItems.splice(oldIndex, 1);
								}

								items.splice(newIndex, 0, removed);

								evt.from.insertBefore(evt.item, nextSibling); // revert element
							}
							else {
								items.splice(newIndex, 0, items.splice(oldIndex, 1)[0]);

								// move ng-repeat comment node to right position
								if (nextSibling.nodeType === Node.COMMENT_NODE) {
									evt.from.insertBefore(nextSibling, evt.item.nextSibling);
								}
							}

							scope.$apply();
						}

						function _destroy() {
							offDestroy();

							angular.forEach(watchers, function (/** Function */unwatch) {
								unwatch();
							});

							sortable.destroy();

							el[expando] = null;
							el = null;
							watchers = null;
							sortable = null;
							nextSibling = null;
						}

						sortable = Sortable.create(el, Object.keys(options).reduce(function (opts, name) {
							opts[name] = opts[name] || options[name];
							return opts;
						}, {
							onStart: function (/**Event*/evt) {
								troops = null;
								nextSibling = evt.from === evt.item.parentNode ? evt.item.nextSibling : evt.clone.nextSibling;
								_emitEvent(evt, null, 'onStart');
								scope.$apply();
							},
							onEnd: function (/**Event*/evt) {
								//troops = null;
								_emitEvent(evt, removed, 'onEnd');
								scope.$apply();
							},
							onAdd: function (/**Event*/evt) {
								_sync(evt);
								_emitEvent(evt, removed, 'onAdd');
								scope.$apply();
							},
							onUpdate: function (/**Event*/evt) {
								_sync(evt);
								_emitEvent(evt, null, 'onUpdate');
							},
							onRemove: function (/**Event*/evt) {
								_emitEvent(evt, removed, 'onRemove');
							},
							onSort: function (/**Event*/evt) {
								_emitEvent(evt, null, 'onSort');
							},
							onLeave: function (/**Event*/evt) {
								_emitEvent(evt, null, 'onLeave');
							},
							onOver: function (/**Event*/evt) {
								_emitEvent(evt, null, 'onOver');
							}
						}));

						angular.forEach([
							'sort', 'disabled', 'draggable', 'handle', 'animation', 'group', 'ghostClass', 'filter',
							'onStart', 'onEnd', 'onAdd', 'onUpdate', 'onRemove', 'onSort', 'onOver', 'onLeave'
						], function (name) {
							watchers.push(scope.$watch('ngSortable.' + name, function (value) {
								if (value !== void 0) {
									options[name] = value;

									if (!/^on[A-Z]/.test(name)) {
										sortable.option(name, value);
									}
								}
							}));
						});

						offDestroy = scope.$on('$destroy', _destroy);
					}
				}
			};
		}]);
});