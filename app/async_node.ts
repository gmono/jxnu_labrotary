import * as fs from "fs";
export type cbkFunc<T>= (err: NodeJS.ErrnoException, data: T) => void;
export function toAsync<T extends Function,Result>(obj:object,func:T)
{
    return (...args)=>{
        let ret=new Promise<Result>((resolve,reject)=>{
            let cbk:cbkFunc<Result>=(err,data)=>{
                if(err) reject(err);
                else resolve(data);
            }
            args.push(cbk);
            func.apply(obj,args);
        });
        return ret;
    };
}
export function fsToAsync<OptionType,Result>(func):(file:fs.PathLike|string,options?:OptionType)=>Promise<Result>
{
    let asyncfunc=toAsync<typeof func,Result>(fs,func);
    return asyncfunc;
}
export const readAsync=fsToAsync<string|{ encoding?: null; flag?: string; },Buffer|string>(fs.readFile);
export const writeAsync=fsToAsync<fs.WriteFileOptions,void>(fs.writeFile);