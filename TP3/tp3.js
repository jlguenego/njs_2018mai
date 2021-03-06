'use strict';
const Promise = require('bluebird');
let mock = '';
let nodeFirebird = 'node-firebird';
let Firebird;
if (global.mode === 'dev') {
    mock = '.mock';
    Firebird = {
        attachAsync: () => {
            return {
                sequentiallyAsync: () => {},
                detachAsync: () => {},
            };
        }
    }
} else {
    Firebird = require(nodeFirebird);
    Promise.promisifyAll(Firebird);
}
const path = require('path');


const fs = require('fs');

const stream = fs.createWriteStream('client.csv');

const { configure, client } = require('./configure-elastic' + mock);

const options = {
    host: '127.0.0.1',
    port: 3050,
    database: path.resolve(__dirname, '../database/PHA.FDB'),
    user: 'SYSDBA',
    password: 'masterkey',
    lowercase_keys: false,
    role: null,
    pageSize: 4096,
};

async function run() {
    try {
        let counter = 0;
        const db = await Firebird.attachAsync(options);
        Promise.promisifyAll(db);

        let acc = [];
        const BULK_SIZE = 10000;

        await configure();
        await db.sequentiallyAsync(
            'SELECT * FROM T_CLIENT ',
            async (row, index) => {
                counter++;
                stream.write(`${row.T_CLIENT_ID};${row.MATRICULE};${row.NOM}` + '\n');

                acc.push({ index: { _index: 'client', _type: 'MesClients', _id: row.T_CLIENT_ID } });
                acc.push(row);
                if (acc.length >= 2 + BULK_SIZE) {
                    try {
                        // console.log('counter', counter);
                        const body = acc;
                        acc = [];
                        await client.bulk({ body });
                    } catch (e) {
                        console.log('error', e);
                    }
                }
            });
        const body = acc;
        acc = [];
        await client.bulk({ body });
        console.log('counter = ', counter);
        await db.detachAsync();
    } catch (e) {
        console.log('err', e);
    }
};

module.exports = {
    run
}
