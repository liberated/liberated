qx.Class.define("jetty.Services",
{
  extend : qx.core.Object,

  construct : function(rpc)
  {
    this.base(arguments);

    /**
     * Register a service name and function.
     *
     * @param serviceName {String}
     *   The name of this service within the <[rpcKey]> namespace.
     *
     * @param fService {Function}
     *   The function which implements the given service name.
     * 
     * @param paramNames {Array}
     *   The names of the formal parameters, in order.
     */
    function registerService(serviceName, fService, paramNames)
    {
      // Register with the RPC provider
      rpc.registerService(serviceName, fService, this, paramNames);
    }

    //
    // Register each of our functions
    //
    registerService("echo",
                    this.echo,
                    [ ]);

    registerService("getInteger",
                    this.getInteger,
                    [ ]);

    registerService("getFloat",
                    this.getFloat,
                    [ ]);

    registerService("getString",
                    this.getString,
                    [ ]);

    registerService("getBadString",
                    this.getBadString,
                    [ ]);

    registerService("getArrayInteger",
                    this.getArrayInteger,
                    [ ]);

    registerService("getArrayString",
                    this.getArrayString,
                    [ ]);

    registerService("getObject",
                    this.getObject,
                    [ ]);

    registerService("getTrue",
                    this.getTrue,
                    [ ]);

    registerService("getFalse",
                    this.getFalse,
                    [ ]);

    registerService("getNull",
                    this.getNull,
                    [ ]);

    registerService("isInteger",
                    this.isInteger,
                    [ "val" ]);

    registerService("isFloat",
                    this.isFloat,
                    [ "val" ]);

    registerService("isString",
                    this.isString,
                    [ "val" ]);

    registerService("isBoolean",
                    this.isBoolean,
                    [ "val" ]);

    registerService("isArray",
                    this.isArray,
                    [ "val" ]);

    registerService(".isObject",
                    this.isObject,
                    [ "val" ]);

    registerService("isNull",
                    this.isNull,
                    [ "val" ]);

    registerService("getParam",
                    this.getParam,
                    [ "val" ]);

    registerService("getCurrentTimestamp",
                    this.getCurrentTimestamp,
                    [ ]);

    registerService("getError",
                    this.getError,
                    [ ]);
  },

  members :
  {
    __rpc : null,

    // Echo the parameter
    echo : function(s)
    {
      return s;
    },

    // Get an integer value
    getInteger : function()
    {
      return 1;
    },

    // Return a floating point value
    getFloat : function()
    {
      return 1/3;
    },

    // Return a string
    getString : function()
    {
      return "Hello world";
    },

    // Return a bad string
    getBadString : function()
    {
      return "<!DOCTYPE HTML \"-//IETF//DTD HTML 2.0//EN\">";
    },

    // Return an array of integers
    getArrayInteger : function()
    {
      return [ 1, 2, 3, 4 ];
    },

    // Return an array of strings
    getArrayString : function()
    {
      return [ "one", "two", "three", "four" ];
    },

    // Return some arbitrary object
    getObject : function()
    {
      return { x : 23, y : 42 };
    },

    // Return true
    getTrue : function()
    {
      return true;
    },

    // Return false
    getFalse : function()
    {
      return false;
    },

    // Return null
    getNull : function()
    {
      return null;
    },

    // Determine if the parameter is an integer
    isInteger : function(val)
    {
      return (qx.lang.Type.isNumber(val) &&
              parseInt(val) == val &&
              parseInt(val).toString().length == val.toString().length);
    },

    // Determine if the parameter is a floating point number.
    // Any number will do.
    isFloat : qx.lang.Type.isNumber,

    // Determine if the parameter is a string.
    isString : qx.lang.Type.isString,

    // Determine if the parameter is a boolean.
    isBoolean : function(val)
    {
      return val !== null && val instanceof Boolean;
    },

    // Determine if the parameter is an array
    isArray : qx.lang.Type.isArray,

    // Determine if the parameter is an object
    isObject : qx.lang.Type.isObject,

    // Determine if the parameter is null
    isNull : function(val)
    {
      return val === null;
    },

    // Return all of the parameters
    getParams : function()
    {
      return qx.lang.Array.fromArguments(arguments);
    },

    // Return the first parameter
    getParam : function(val)
    {
      return val;
    },

    // Get the current time, in both seconds since epoch and map formats
    getCurrentTimestamp : function()
    {
      var t = new Date();
      var o = 
        {
          now  : t.getTime() / 1000,
          json : 
          {
            year : t.getUTCFullYear(),
            month : t.getUTCMonth(),
            day : t.getUTCDate(),
            hour : t.getUTCHours(),
            minute : t.getUTCMinutes(),
            second : t.getUTCSeconds(),
            millisecond : t.getUTCMilliseconds()
          }
        };
      return o;
    },

    // Return an RPC error
    getError : function()
    {
      var error = new liberated.rpc.error.Error("qx1");
      error.setCode(23);
      error.setMessage("This is an application-provided error");
      return error;
    }
  }
});
