'use strict';

var chai = require('chai'),
  expect = chai.expect,
  sinon = require('sinon'),
  integrity = require('../integrity');

chai.use(require('sinon-chai'));

describe('integrity', function () {

  var sandbox;

  beforeEach(function () {
    integrity.resetAll();
    sandbox = sinon.sandbox.create('integrity');
  });

  it('should provide a function', function () {
    expect(integrity).to.be.a('function');
  });

  describe('integrity', function () {

    it('should provide an object with an id', function () {
      var o = integrity();
      expect(o.__idx_id__).to.be.a('string');
      expect(o.__idx_id__.length).to.equal(32);
    });

    it('should not provide a $join function if given no field', function () {
      var o = integrity();
      expect(o.$join).to.be.undefined;
    });

    it('should provide a $join function if given a field', function () {
      var o = integrity('foo');
      expect(o.$join).to.be.an('object');
      expect(o.$join.foo).to.be.a('function');
    });

    it('should allow updates', function () {
      var o = integrity('foo');
      expect(o.foo).to.be.undefined;
      o.foo = 'bar';
      expect(o.foo).to.equal('bar');
    });
    it('should disallow a delete', function () {
      var o = integrity('foo');
      expect(function () {
        delete o.foo;
      }).to.throw(TypeError);
    });

  });

  describe('joins', function () {
    it('should do a cascading update', function () {
      var o = integrity('foo'),
        p = {};
      o.$join.foo(p, 'bar');
      o.foo = 'baz';
      expect(o.foo).to.equal('baz');
      expect(p.bar).to.equal('baz');
    });

    it('should disallow an undefined value', function () {
      var o = integrity('foo'),
        p = {};
      o.$join.foo(p, 'bar');
      o.foo = 'baz';
      expect(function () {
        o.foo = undefined;
      }).to.throw('cannot set property "foo" undefined');
      expect(o.foo).to.equal('baz');
      expect(p.bar).to.equal('baz');
    });

    it('should allow disjoin', function () {
      var o = integrity('foo'),
        p = {},
        disjoin = o.$join.foo(p, 'bar');
      o.foo = 'baz';
      disjoin();
      o.foo = 'quux';
      expect(p.bar).to.equal('baz');
    });
  });
});
