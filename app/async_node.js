"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
function toAsync(obj, func) {
    return (...args) => {
        let ret = new Promise((resolve, reject) => {
            let cbk = (err, data) => {
                if (err)
                    reject(err);
                else
                    resolve(data);
            };
            args.push(cbk);
            func.apply(obj, args);
        });
        return ret;
    };
}
exports.toAsync = toAsync;
function fsToAsync(func) {
    let asyncfunc = toAsync(fs, func);
    return asyncfunc;
}
exports.fsToAsync = fsToAsync;
exports.readAsync = fsToAsync(fs.readFile);
exports.writeAsync = fsToAsync(fs.writeFile);
//# sourceMappingURL=async_node.js.map