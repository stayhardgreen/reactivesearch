import { Actions, helper } from '@appbaseio/reactivecore';
import VueTypes from 'vue-types';

import { connect } from '../utils/index';
import types from '../utils/vueTypes';
import Base from '../styles/Base';

const { setHeaders, setValue } = Actions;
const { isEqual } = helper;

const URLParamsProvider = {
	name: 'URLParamsProvider',

	props: {
		className: types.string,
		headers: types.headers,
		getSearchParams: types.func,
		setSearchParams: types.func,
		as: VueTypes.string.def('div'),
	},
	mounted() {
		this.init();

		window.onpopstate = () => {
			this.init();
			const activeComponents = Array.from(this.params.keys());
			// remove inactive components from selectedValues
			Object.keys(this.currentSelectedState)
				.filter((item) => !activeComponents.includes(item))
				.forEach((component) => {
					this.setValue(
						component,
						null,
						undefined,
						undefined,
						undefined,
						undefined,
						undefined,
						undefined,
						'URL',
					);
				});
			// update active components in selectedValues
			Array.from(this.params.entries()).forEach((item) => {
				try {
					const [component, value] = item;
					const { label, showFilter, URLParams } = this.selectedValues[component] || {
						label: component,
					};
					this.setValue(
						component,
						JSON.parse(value),
						label,
						showFilter,
						URLParams,
						undefined,
						undefined,
						undefined,
						'URL',
					);
				} catch (e) {
					// Do not set value if JSON parsing fails.
					console.error(e);
				}
			});
		};
	},
	watch: {
		$route() {
			// this ensures the url params change are handled
			// when the url changes, which enables us to
			// make `onpopstate` event handler work with history.pushState updates
			this.checkForURLParamsChange();
		},
		selectedValues(newVal, oldVal) {
			if (!isEqual(newVal, oldVal)) {
				this.searchString = this.$props.getSearchParams
					? this.$props.getSearchParams()
					: window.location.search;
				this.params = new URLSearchParams(this.searchString);
				const currentComponents = Object.keys(newVal);
				const urlComponents = Array.from(this.params.keys());
				let shouldPushHistory = false;
				currentComponents
					.filter((component) => newVal[component].URLParams)
					.forEach((component) => {
						const selectedValues = newVal[component];
						// prevents empty history pollution on initial load
						if (
							this.hasValidValue(newVal[component])
							|| this.hasValidValue(oldVal[component])
						) {
							if (selectedValues.URLParams) {
								if (selectedValues.category) {
									const shouldUpdateHistory = this.setURL(
										component,
										this.getValue({
											category: selectedValues.category,
											value: selectedValues.value,
										}),
									);
									if (shouldUpdateHistory) {
										shouldPushHistory = true;
									}
								} else {
									const shouldUpdateHistory = this.setURL(
										component,
										this.getValue(selectedValues.value),
									);
									if (shouldUpdateHistory) {
										shouldPushHistory = true;
									}
								}
							} else {
								this.params.delete(component);
								shouldPushHistory = true;
							}
						} else if (
							!this.hasValidValue(newVal[component])
							&& urlComponents.includes(component)
						) {
							// doesn't have a valid value, but the url has a (stale) valid value set
							this.params.delete(component);
							shouldPushHistory = true;
						}
					});

				// remove unmounted components
				Object.keys(newVal)
					.filter((component) => !currentComponents.includes(component))
					.forEach((component) => {
						this.params.delete(component);
						shouldPushHistory = true;
					});

				if (!currentComponents.length) {
					Array.from(this.params.keys()).forEach((item) => {
						if (this.searchComponents && this.searchComponents.includes(item)) {
							this.params.delete(item);
							shouldPushHistory = true;
						}
					});
				}

				if (shouldPushHistory) {
					this.pushToHistory();
				}
			}
		},
		headers(newVal, oldVal) {
			if (!isEqual(oldVal, newVal)) {
				this.setHeaders(newVal);
			}
		},
	},
	methods: {
		init() {
			this.searchString = this.$props.getSearchParams
				? this.$props.getSearchParams()
				: window.location.search;
			this.params = new URLSearchParams(this.searchString);
			this.currentSelectedState = this.selectedValues || {};
		},

		checkForURLParamsChange() {
			// we only compare the search string (window.location.search by default)
			// to see if the route has changed (or) not. This handles the following usecase:
			// search on homepage -> route changes -> search results page with same search query
			if (window) {
				const searchString = this.$props.getSearchParams
					? this.$props.getSearchParams()
					: window.location.search;

				if (searchString !== this.searchString) {
					let event;
					if (typeof Event === 'function') {
						event = new Event('popstate');
					} else {
						// Correctly fire popstate event on IE11 to prevent app crash.
						event = document.createEvent('Event');
						event.initEvent('popstate', true, true);
					}

					window.dispatchEvent(event);
				}
			}
		},

		hasValidValue(component) {
			if (!component) return false;
			if (Array.isArray(component.value)) return !!component.value.length;
			return !!component.value;
		},

		getValue(value) {
			if (Array.isArray(value) && value.length) {
				return value.map((item) => this.getValue(item));
			}
			if (value && typeof value === 'object') {
				// TODO: support for NestedList
				if (value.location) return value;
				if (value.category) return value;
				return value.label || value.key || null;
			}
			return value;
		},

		setURL(component, value) {
			if (
				!value
				|| (typeof value === 'string' && value.trim() === '')
				|| (Array.isArray(value) && value.length === 0)
			) {
				this.params.delete(component);
				return true;
			}
			const data = JSON.stringify(value);
			if (data !== this.params.get(component)) {
				this.params.set(component, data);
				return true;
			}
			return false;
		},

		pushToHistory() {
			const paramsSting = this.params.toString() ? `?${this.params.toString()}` : '';
			const base = window.location.href.split('?')[0];
			const newURL = `${base}${paramsSting}`;

			if (this.$props.setSearchParams) {
				this.$props.setSearchParams(newURL);
			} else if (window.history.pushState) {
				window.history.pushState({ path: newURL }, '', newURL);
			}
			this.init();
		},
	},
	render() {
		const children = this.$slots.default();
		return (
			<Base as={this.$props.as} class={this.$props.className}>
				{children}
			</Base>
		);
	},
};

const mapStateToProps = (state) => ({
	selectedValues: state.selectedValues,
	searchComponents: state.components,
});

const mapDispatchtoProps = {
	setHeaders,
	setValue,
};

URLParamsProvider.install = function (Vue) {
	Vue.component(URLParamsProvider.name, URLParamsProvider);
};
export default connect(mapStateToProps, mapDispatchtoProps)(URLParamsProvider);
