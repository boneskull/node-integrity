# integrity

Maintain referential integrity between JS objects

## Example

General idea:

```js
var integrity = require('integrity');

// init empty object with a "bar" property.
// updates to this property will cascade to any referencing objects.
var foo = integrity('bar', {
  update: 'cascade'
});
foo.bar === undefined; // true

// init some other object
var baz = {};

// baz.quux will now reference foo.bar
foo.$join.bar(baz, 'quux');
baz.quux === undefined; // true

// set foo.bar to some value
foo.bar = 1;

baz.quux === foo.bar; // true
```

## Author

[Christopher Hiller](http://boneskull.github.io)

## License

MIT
