/**
 *
 * @module integrity
 */

'use strict';

var DEFAULT_ID_LENGTH = 32,
  DEFAULT_INDEX_ID_FIELD = '__idx_id__',
  DEFAULT_REF_ID_FIELD = '__ref_id__',
  DEFAULT_JOIN_NAME = '$join',
  DEFAULT_MAX_LISTENERS = 10,

  CONSTRAINTS = {
    remove: {
      restrict: function restrictRemove(iterRefs) {
        return function restrictRemoveHandler(data) {
          iterRefs(function (ref) {
            var ref_object = ref.value;
            if (isObject(ref_object) && !isUndefined(ref_object[ref.field])) {
              this.emit('rollback', {
                field: data.field,
                stack: data.stack
              });
              return false;
            }
            return true;
          }, this);
          this.emit('commit', data);
        }
      },
      cascade: function cascadeRemove(iterRefs) {
        return function cascadeRemoveHandler(data) {
          cascade.call(this, iterRefs, data);
        }
      }
    },
    update: {
      restrict: function restrictUpdate(iterRefs) {
        return function restrictUpdateHandler(data) {
          iterRefs(function (ref) {
            var ref_object = ref.value;
            if (isObject(ref_object) && ref_object[ref.field] !== data.value) {
              this.emit('rollback', {
                field: data.field,
                stack: data.stack
              });
              return false;
            }
            return true;
          }, this);
          this.emit('commit', data);
        }
      },
      cascade: function cascadeUpdate(iterRefs) {
        return function cascadeUpdateHandler(data) {
          cascade.call(this, iterRefs, data);
        };
      }

    }
  },
  ALPHABET = '0123456789ABCDEF',

  store;

var cascade = function cascade(iterRefs, data) {
  iterRefs(function (ref) {
    if (!isUndefined(ref.value)) {
      ref.value[ref.field] = data.value;
    }
  }, this);
  this.emit('commit', {
    field: data.field,
    value: data.value
  });
};

var isUndefined = function isUndefined(value) {
  return typeof(value) === 'undefined';
};

var isObject = function isObject(value) {
  return typeof(value) === 'object' && value !== null;
};

var makeIterRefs = function makeIterRefs(refs) {
  return function iterRefs(callback, context) {
    var ref_id;
    context = context || null;
    for (ref_id in refs) {
      if (refs.hasOwnProperty(ref_id)) {
        if (callback.call(context, refs[ref_id], ref_id) === false) {
          return;
        }
      }
    }
  }
};

var noop = function noop() {
};

var createHandlers = function createHandlers(field) {
  var iterRefs = makeIterRefs(field.refs);
  return {
    remove: (CONSTRAINTS.remove[field.constraint.remove] || noop)(iterRefs),
    update: (CONSTRAINTS.update[field.constraint.update] || noop)(iterRefs)
  };
};

var createJoin = function createJoin(field) {
  return function join(destination, dest_field, callback) {
    var ref,
      id,
      ref_field;
    ref_field = DEFAULT_REF_ID_FIELD;
    if (!destination) {
      throw new Error('destination object is required');
    }
    if (!dest_field) {
      throw new Error('destination field is required');
    }
    if (!destination[ref_field]) {
      ref = {
        value: destination,
        field: dest_field,
        callback: callback
      };
      id = destination[ref_field] = integrity._createId();
      field.refs[id] = ref;
    }
    return function disjoin() {
      delete destination[ref_field];
      delete field.refs[id];
    };
  };
};

var define = function define(obj, prop, field) {
  Object.defineProperty(obj, prop, {
    get: function getField() {
      return field.value;
    },
    set: function setField(new_value) {
      var old_value = field.value,
        stack = new Error().stack;
      if (new_value !== old_value) {
        if (isUndefined(new_value)) {
          this.emit('pre-remove', {
            field: field_name
          });
          this.emit('remove.' + field_name, {
            stack: stack
          });
          this.emit('post-remove', {
            field: field_name
          });
        } else {
          this.emit('pre-update', {
            field: field_name
          });
          this.emit('update.' + field_name, {
            value: new_value,
            stack: stack
          });
          this.emit('post-update', {
            field: field_name
          });
        }
      }
    }
  });
};

var listen = function listen(obj, prop, field) {
  var handlers = createHandlers(field);
  container.on('update.' + field_name, handlers.update.bind(container));
  container.on('remove.' + field_name, handlers.remove.bind(container));
};

var provide = function provide(obj, prop, field) {
  (container[DEFAULT_JOIN_NAME] = container[DEFAULT_JOIN_NAME] || {})[field_name] =
    createJoin(field);
};


var initField = function initField(container, field_name, constraint) {
  var field = {
    constraint: constraint,
    refs: {}
  };

  define(container, field_name, field);
  listen(container, field_name, field);
  provide(container, field_name, field);

  return field;
};

var containerProto = {
  on: function on(event, handler) {
    var listeners = this.__listeners__,
      event_listeners = listeners[event];
    if (!event_listeners) {
      event_listeners = listeners[event] = [];
    }
    if (event_listeners.length === this.__max_listeners__) {
      throw new Error('max listeners for event "' + event + '" exceeded.');
    }
    this.emit('newListener', event, handler);
    event_listeners.push(handler);
  },
  emit: function emit(event, data) {
    var event_listeners = this.__listeners__[event] || [];
    event_listeners.forEach(function (handler) {
      handler.call(null, data);
    });
  },
  removeListener: function removeListener(event, handler) {
    var idx,
      listeners = this.__listeners__[event] || [];
    if (~(idx = listeners.indexOf(handler))) {
      listeners.splice(idx, 1);
      this.emit('removeListener', event, handler);
    }
  },
  removeAllListeners: function removeAllListeners(event) {
    if (event) {
      this.__listeners__[event] = [];
    } else {
      this.__listeners__ = {};
    }
  },
  listeners: function listeners(event) {
    return this.__listeners__[event];
  },
  setMaxListeners: function setMaxListeners(num) {
    this.__max_listeners__ = num;
  }
};

var initContainer = function initContainer(container) {
  var fields = {},
    id = integrity._createId();

  container[DEFAULT_INDEX_ID_FIELD] = id;
  container.__listeners__ = {};
  container.__max_listeners__ = DEFAULT_MAX_LISTENERS;

  defaults(container, containerProto);

  store[id] = {
    fields: fields
  };

  container.on('commit', function (data) {
    fields[data.field].value = data.value;
  });

};

var extend = function extend(dest, src) {
  var prop;
  for (prop in src) {
    if (src.hasOwnProperty(prop)) {
      dest[prop] = src.prop;
    }
  }
  return dest;
};

var defaults = function defaults(dest, src) {
  var prop;
  for (prop in src) {
    if (src.hasOwnProperty(prop) && isUndefined(dest[prop])) {
      dest[prop] = src.prop;
    }
  }
  return dest;
};

var integrity = function integrity(container, field_name, constraint) {
  var index,
    id,
    field;

  if (typeof container === 'string') {
    constraint = field_name;
    field_name = container;
    container = {};
  } else {
    container = container || {};
  }

  id = container[DEFAULT_INDEX_ID_FIELD];
  if (id && (index = store[id])) {
    if (field_name) {
      if ((field = index.fields[field_name])) {
        extend(field.constraint, constraint || {});
      } else {
        index.fields[field_name] = initField(container, field_name, constraint || {});
      }
    }
    return container;
  }

  initContainer(container);

  if (field_name) {
    fields[field_name] = initField(container, field_name, constraint || {});
  }

  return container;
};

integrity.info = function info(container) {
  if (container) {
    return store[container[DEFAULT_INDEX_ID_FIELD]];
  }
  return store;
};

integrity._createId = function createId(count) {
  var id = '',
    len = ALPHABET.length;

  count = count || DEFAULT_ID_LENGTH;
  while (count--) {
    id += ALPHABET.charAt(Math.floor(Math.random() * len));
  }
  return id;
};

integrity.resetAll = function resetAll() {
  store = {};
};

integrity.resetAll();

module.exports = integrity;
