# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-11-23

### Added
- `matchByName` option fills fields whose `name` or `id` matches a parameter that has no mapping
- `cleanUrl` option removes the parameters that filled a field from the address bar
- `persist` and `persistStorage` options remember parameters such as `utm_*` across pages, and `clearPersisted()` forgets them
- `overwrite: false` leaves fields that already have a value alone
- Repeated parameters fill checkbox groups and multi-selects with every value
- `prefix` option only reads parameters with a given prefix, such as `ff_`
- `transform` option changes values before they're filled
- `allow` option limits which parameters can fill fields
- `buildPrefillUrl()` builds correctly encoded prefill links

### Changed
- A single checkbox is also checked when the value equals its own `value` attribute
- Password, file and button inputs are never filled, even when mapped

## [1.2.0] - 2026-11-23

### Added
- `observeDOM`, `domObserverTimeout` and `maxDOMObserveRetries` options to fill forms that render after page load
- `destroy()` method to cancel a pending fill, DOM observation and auto-submit
- `exports` map with separate ESM and CommonJS entry points and type declarations
- `npm run test:package` smoke test for the published entry points

### Changed
- Native auto-submit now uses `form.requestSubmit()` (falling back to `form.submit()`), so browser validation and `submit` event handlers run. A submission blocked by validation calls `onError` instead of `onAfterSubmit`
- Field values are set through the native property setter, so frameworks that track input values (such as React) see the change
- `tslib` moved to `devDependencies`; the package has no runtime dependencies

### Fixed
- CommonJS build is now `dist/index.cjs`; `require()` of the package failed because `"type": "module"` made Node treat `dist/index.js` as ESM
- Fields are looked up inside the target form (or associated with it via the `form` attribute) instead of anywhere on the page
- Values containing `%` were decoded twice, throwing `URI malformed` and aborting the fill
- Query parameters named after `Object.prototype` members (e.g. `constructor`) aborted the fill
- An invalid selector in one mapping no longer prevents other fields from being filled
- Selects and radios with no matching option, and checkboxes with an unrecognised value, are no longer counted as filled (and no longer trigger auto-submit)
- Radio `input`/`change` events now fire on the radio that was checked
- `maxDOMObserveRetries` now limits retries, and a stale observer timeout no longer stops a newer observer
- Calling `fillForm()` repeatedly no longer schedules multiple auto-submits

## [1.1.0] - 2024-03-19

### Added
- New `customSubmitFunction` option to support custom form submission logic
- Support for both synchronous and asynchronous custom submit functions
- Integration with existing callback system for custom submissions
- Documentation updates for the new feature

### Changed
- Updated form submission logic to handle both native and custom submissions
- Improved type definitions for better TypeScript support

## [1.0.1] - 2024-03-19

### Fixed
- Initial release with bug fixes and improvements

## [1.0.0] - 2024-03-19

### Added
- Initial release
- Smart form filling based on URL query parameters
- Support for multiple input types
- Customizable field mappings
- Auto-submit functionality
- Debug mode
- TypeScript support
- Event hooks for form submission and error handling 