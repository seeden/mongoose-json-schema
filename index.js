'use strict';

function parseMongoosePath(path, schema) {
	path = path || '';

	schema = schema || {
		type: "object",
		properties: {},
		required: [],
		additionalProperties: false
	};

	var parts = path.split('.'),
		properties = schema.properties;

	for(var i=0; i<parts.length-1; i++) {
		var part = parts[i];

		if(!properties[part]) {
			properties[part] = {
				type: "object",
				properties: {},
				required: [],
				additionalProperties: false
			};
		}

		schema = properties[part];
	}

	return schema;
}

function parseMongooseType(schema, type, options) {
	var json = {};

	if(type === false || options.auto) {
		return null;
	} else if(type === String) {
		json.type = 'string';

		if(typeof options.minLength !== 'undefined') {
			json.minLength = options.minLength;
		}

		if(typeof options.maxLength !== 'undefined') {
			json.maxLength = options.maxLength;
		}
	} else if(type === Boolean) {
		json.type = 'boolean';
	} else if(type === schema.constructor.Types.ObjectId) {
		json.type = 'string';
		json.pattern = /^[a-fA-F0-9]{24}$/.source;
	} else if(type === Number) {
		json.type = 'number';

		if(typeof options.min !== 'undefined') {
			json.minimum = options.min;
		}

		if(typeof options.max !== 'undefined') {
			json.maximum = options.max;
		}
	} else if(type === Date) {
		json.type = 'string';
		json.pattern = /(\d\d\d\d)(-)?(\d\d)(-)?(\d\d)(T)?(\d\d)(:)?(\d\d)(:)?(\d\d)(\.\d+)?(Z|([+-])(\d\d)(:)?(\d\d))/.source
	} else if(Array.isArray(type)) {
		json.type = 'array';

		if(options.minItems) {
			json.minItems = options.minItems;
		}

		if(options.uniqueItems) {
			json.uniqueItems = options.uniqueItems;
		}

		//process array item
		var itemType = type.length ? type[0] : schema.constructor.Types.Mixed;
		var itemOptions = itemType.type ? itemType : { type: itemType };

		itemType = itemType.type ? itemType.type : itemType;

		json.item = parseMongooseType(schema, itemType, itemOptions);
	}

	return json;
}

function defaultExcludeFn(path, options) {
	if(options.readOnly) {
		return false;
	}

	var field = path.split('.').pop();
	if(field === '__v') {
		return false;
	}

	return true;
}

function defaultRequireFn (path, options) {
	if(options.required  && typeof options.default === 'undefined') {
		return true;
	}

	return false;
}

function restPatchRequireFn(path, options) {
	return false;
}

function restPatchExcludeFn(path, options) {
	if(options.patch === false) {
		return false;
	}

	return defaultExcludeFn(path, options);
}


function restExcludePathsFn(paths) {
	var obj = {};
	for(var i=0; i<paths.length; i++) {
		obj[paths[i]] = true;
	}

	return function(path, options) {
		if(obj[path] === true) {
			return false;
		}

		return defaultExcludeFn(path, options);
	};
}

function parseMongooseSchema(schema, excludeFn, requireFn) {
	var jsonSchema = parseMongoosePath();

	excludeFn = excludeFn || defaultExcludeFn;
	requireFn = requireFn || defaultRequireFn;

	schema.eachPath(function(path, config) {
		var localJSONSchema = parseMongoosePath(path, jsonSchema),
			field = path.split('.').pop(),
			type = config.options.type,
			caster = config.caster || {},
			options = caster.options || config.options || {};

		if(!excludeFn(path, options)) {
			return;
		}

		var fieldValue = null;

		if(config.schema) {
			fieldValue = parseMongooseSchema(config.schema, excludeFn, requireFn);
		} else {
			fieldValue = parseMongooseType(schema, type, options);
		}

		if(!fieldValue) {
			return;
		}

		if(requireFn(path, options)) {
			localJSONSchema.required.push(field);
		}

		localJSONSchema.properties[field] = fieldValue;
	});

	return jsonSchema;
}

module.exports = function localePlugin (schema, options) {
	//prepare arguments
	options = options || {};

	schema.methods.getJSONSchema = function(excludeFn, requireFn) {
		return parseMongooseSchema(schema, excludeFn || options.excludeFn, requireFn || options.requireFn);
	};

	schema.statics.getJSONSchema = function(excludeFn, requireFn) {
		return parseMongooseSchema(schema, excludeFn || options.excludeFn, requireFn || options.requireFn);
	};
};

module.exports.parseMongoosePath = parseMongoosePath;
module.exports.parseMongooseType = parseMongooseType;


module.exports.defaultExcludeFn = defaultExcludeFn;
module.exports.defaultRequireFn = defaultRequireFn;

module.exports.restPatchRequireFn = restPatchRequireFn;

module.exports.restPatchExcludeFn = restPatchExcludeFn;
module.exports.restExcludePathsFn = restExcludePathsFn;


