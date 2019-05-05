import * as posthtml from "posthtml";
import * as parser from "posthtml-parser";
import * as render from "posthtml-render";
import { readAsync,writeAsync } from "./app/async_node";
let html=posthtml as PostHtmlModule;
const getRandomStr=()=>Math.random().toString(36).substr(2);
import { ApiSet, ApiReset, ApiRecord } from "./app/posthtml_api";
import * as postcss from "postcss";
function isBrowser(){
    try
    {
        window&&window instanceof Window;
        return true;
    }
    catch(e)
    {
        return false;
    }
}
//加载文件
async function loadTxt(url)
{
    if(isBrowser())
    {
        let res=await fetch(url);
        if(res.ok)
        {
            let txt=await res.text();
            return txt;
        }
        return null;

    }
    else
    {
        let txt=await readAsync(url,"utf-8");
        return txt;
    }
}
function deleteContainer(expression:PostHTMLNode|PostHTMLNode[])
{
    //删除容器释放内容物
    return async (tree:PostHTMLTree)=>{
        ApiSet(tree,"last");
        await tree.match(expression,(p)=>{
            if(typeof p=="object")
                return p.content;
            else return p;
        })
        ApiReset(tree);
    }
}
function deleteElement(expression:PostHTMLNode|PostHTMLNode[])
{
    //直接删除节点
    return async (tree:PostHTMLTree)=>{
        ApiSet(tree,"last");
        await tree.match(expression,(p)=>{
            if(typeof p=="string") return p;
            else return [];
        })
        ApiReset(tree);
    }
}
const signCss=async (tree:PostHTMLTree)=>{
    //处理所有style标签内的css
    ApiSet(tree);
    let modsign=tree.messages[tree.messages.length-1].modsign;
    await tree.match({tag:"style"},async (p)=>{
        if(typeof p=="string") return p;
        let css=await postcss().use((root)=>{
            root.walkRules((selector,idx)=>{
                //处理css选择器
                selector.selectors=selector.selectors.map((value,idx)=>{
                    return `${value}[data-sign=${modsign}]`;
                });
                return selector;
            })
        }).process(p.content).css;
        p.content=[css];
        return p;
    });
    ApiReset(tree);
}
const deleteDocType=async (tree:PostHTMLTree)=>{
    await tree.walk((p)=>{
        if(typeof p=="string"&&p.trim().toLowerCase().startsWith("<!doctype"))
        {
            return "";
        }
        return p;

    });
}
async function pack(str:string){
    let ret;
    let h=await html([ApiRecord])
    .use(deleteDocType)
    .use((tree)=>{
        //给所有标签打上模块sign
        let modsign=getRandomStr();
        tree.walk(cb=>{
            if(typeof cb=="string") return cb;
            if(cb.attrs==null) cb.attrs=[];
            cb.attrs[`data-sign`]=modsign;
            return cb;
        });
        tree.messages.push({modsign:modsign});

    })
    .use(async (tree)=>{
        ApiSet(tree);
        //将所有的link进来的css文件都加载到内置标签中
        await tree.match({tag:"link"},async (p)=>{
            if(typeof p=="string") return p;
            if("rel" in p.attrs&&p.attrs["rel"]=="stylesheet")
            {
                let href=p.attrs["href"];
                //加载链接内容
                let txt=await loadTxt(href) as string;
                if(txt==null) p.tag="style";
                else{
                    p.tag="style";
                    p.attrs={};
                    p.content=[txt];
                }
            }
            return p;
        });
    }).use(deleteContainer([{tag:"html"},{tag:"body"},{tag:"head"}]))
    .use(deleteElement([{tag:"meta"},{tag:"title"}]))
    .use(signCss).process(str);
    console.log(h.html);
    return h.html;
};


async function main()
{
    pack(await readAsync("./app/assets/page1.html","utf-8") as string);
}
main();