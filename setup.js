// const exec_mssql = require('exec-mssql');
const { exec, spawn } = require('child_process');
require('dotenv').config();
var argv = require('minimist')(process.argv.slice(2));

const configPrefix = argv['dev'] ? 'dev_' : ( argv['test'] ? 'test_' : '' );

const config = {
  user:            process.env[ configPrefix + "user"],
  password:        process.env[ configPrefix + "password"],
  server:          process.env[ configPrefix + "server"],
  database:        process.env[ configPrefix + "database"],
  options_encrypt: process.env[ configPrefix + "options_encrypt"],
}

const setup = require('./setup.json');

var sqlcmdargs = '-S tcp:' + config.server + ' -d ' + config.database + ' -U ' + config.user + ' -P ' + config.password + ' -m 1 -i'
sqlcmdargs = sqlcmdargs.split(' ');

/**
 * process an array of items in order one by one
 *
 * @param {Array} items that should be sequentially processed
 * @param {function} fn callback
 */
function forEachPromise( funcs ) {
  return funcs.reduce( ( promise, func ) => {
    return promise.then( () => {
      return func();
    }).catch( error => {
      return func();
    });
  }, Promise.resolve() );
}

const setupFuncs = [() => {
  console.log( 'starting' );
}];

setup.steps.forEach( majorStep => {

  setupFuncs.push( () => {
    console.log("\r\n########################################\r\n#\r\n#  " + majorStep.section.description + "\r\n#\r\n");
  });

  if ( majorStep.section.type === 'sql' && majorStep.steps ) {
    majorStep.steps.forEach( minorStep => {
      setupFuncs.push( () => {

        return new Promise( ( resolve, reject ) => {
          var filePath = minorStep;
          var args = []
          sqlcmdargs.forEach( a => {
            args.push( a );
          });
          args.push( filePath );
          var sqlcmd = spawn( 'sqlcmd', args );
          sqlcmd.stdout.on('data', data => {
            console.log( data.toString().replace(/\r\n$/gmi, '') );
          })
          sqlcmd.stderr.on('data', data => {
            console.error( 'error', data.toString() );
            process.exit(0);
          })
          sqlcmd.on('exit', code => {
            resolve();
          })

        })
      })
    });
  }

  if ( majorStep.section.type === 'cli' ) {
    if ( majorStep.commands[process.platform] ) {
      setupFuncs.push( () => {
        exec( majorStep.commands[process.platform].replace('${process.env.fileName}', process.env.fileName) );
      })
    }
  }

})

forEachPromise( setupFuncs ).then( () =>{
  console.log( 'finished' );
}).catch( error => {
  console.log( 'error', error );
});


