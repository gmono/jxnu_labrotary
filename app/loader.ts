import posthtml = require("posthtml");
import { parser } from "posthtml-parser";
import { render } from "posthtml-render";

let html=posthtml as unknown as PostHtmlModule;
const getRandomStr=()=>Math.random().toString(36).substr(2);
import { ApiSet, ApiReset, ApiRecord } from './posthtml_api';
import postcss from "postcss";
import selectorParser from "postcss-selector-parser";
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
        try
        {
            let res=await fetch(url);
            if(res.ok)
            {
                let txt=await res.text();
                return txt;
            }
            return null;
        }
        catch(e)
        {
            return null;
        }
    
    }
    else
    {
        const loadNodeFs=new Function("return import('./async_node.js')") as ()=>Promise<typeof import("./async_node")>;
        let fs=await loadNodeFs();
        let txt=await fs.readAsync(url,"utf-8");
        return txt;
    }
}
function deleteContainer(expression:PostHTMLNode|PostHTMLNode[])
{
    //删除容器释放内容物
    return async (tree:PostHTMLTree)=>{
        ApiSet(tree,"last");
        try { await tree.match(expression,(p)=>typeof p==="object" ? p.content : p); }
        finally { ApiReset(tree); }
    }
}
function deleteElement(expression:PostHTMLNode|PostHTMLNode[])
{
    //直接删除节点
    return async (tree:PostHTMLTree)=>{
        ApiSet(tree,"last");
        try { await tree.match(expression,(p)=>typeof p==="string" ? p : []); }
        finally { ApiReset(tree); }
    }
}
function getSignCssFunc(sign:string){
    const signCss=async (tree:PostHTMLTree)=>{
        //处理所有style标签内的css
        ApiSet(tree);
        try {
        let modsign=sign;
        await tree.match({tag:"style"},async (p)=>{
            if(typeof p=="string") return p;

            let css=await postcss().use((root)=>{
                root.walkRules((selector,idx)=>{
                    //处理css选择器
                    selector.selectors=selector.selectors.map((value)=>selectorParser((selectors)=>{
                        selectors.each((item)=>{
                            const lastCombinator=item.nodes.reduce((last,node,index)=>node.type==="combinator"?index:last,-1);
                            const compound=item.nodes.slice(lastCombinator+1);
                            if(compound.some((node)=>node.type==="attribute"&&node.attribute==="data-sign")) return;
                            const firstPseudo=compound.find((node)=>node.type==="pseudo");
                            const scope=selectorParser.attribute({attribute:"data-sign",operator:"=",value:modsign,quoteMark:'"',raws:{value:modsign}});
                            if(firstPseudo) item.insertBefore(firstPseudo,scope);
                            else item.append(scope);
                        });
                    }).processSync(value));
                    return selector;
                })
            }).process((p.content ?? []).join(""),{from:undefined}).css;
            p.content=[css];
            return p;
        });
        } finally { ApiReset(tree); }
    }
    return signCss;
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
function getGatcherOfScripts(){
    let scriptContainer={allscripts:""};
    const gatherScripts=async (tree:PostHTMLTree)=>{
        //收集所有script标签 （按从上到下 后序遍历收集)
        //并删除标签
        ApiSet(tree,"last");
        let allscripts="";
        try { await tree.match({tag:"script"},(p)=>{
            //得到代码
            if(typeof p=="string") return p;
            //提示专用的script引入
            if(p.attrs && "declare" in p.attrs) return [];
            let script=(p.content ?? []).join("");
            allscripts+="\n"+script;
            //清除script标签
            return [];
        }); } finally { ApiReset(tree); }
        //保存到容器
        scriptContainer.allscripts=allscripts;
    }
    return {scriptContainer,gatherScripts};
}


//可自定义地提供modsign
async function pack(str:string,pre_middleware:Array<PreMiddleWareFactor>=[],rare_middleware:Array<RareMiddleWareFactor>=[],modsign:string=getRandomStr()){
    let ret;
    let {gatherScripts,scriptContainer}=getGatcherOfScripts();
    let h=await html([ApiRecord].concat(pre_middleware.map((v)=>v(modsign,str))))
    .use(deleteDocType)
    .use((tree)=>{
        //给所有标签打上模块sign
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
        try {
        //将所有的link进来的css文件都加载到内置标签中
        await tree.match({tag:"link"},async (p)=>{
            if(typeof p=="string") return p;
            if(p.attrs && "rel" in p.attrs&&p.attrs["rel"]=="stylesheet")
            {
                let href=p.attrs["href"];
                //加载链接内容
                let txt=await loadTxt(href) as string;
                if(txt==null) return [];
                else{
                    p.tag="style";
                    p.attrs={};
                    p.content=[txt];
                }
            }
            return p;
        });
        } finally { ApiReset(tree); }
    }).use(async (tree)=>{
        //把所有外部script引入内部
        ApiSet(tree);
        try {
        await tree.match({tag:"script"},async (p)=>{
            if(typeof p=="string") return p;
            if(p.attrs && "src" in p.attrs)
            {
                let src=p.attrs["src"];
                let txt=await loadTxt(src) as string;
                if(txt==null) return [];
                else{
                    delete p.attrs["src"];
                    p.content=[txt];
                }
            }
            return p;
        })
        } finally { ApiReset(tree); }
    })
    .use(deleteContainer([{tag:"html"},{tag:"body"},{tag:"head"}]))
    .use(deleteElement([{tag:"meta"},{tag:"title"}]))
    .use(getSignCssFunc(modsign))
    .use(gatherScripts)
    .process(str);
    //后处理部分
    let phtml=h.html;
    if(rare_middleware.length!=0)
    {
        phtml=(await html([ApiRecord].concat(rare_middleware.map((v)=>v(modsign,phtml,scriptContainer)))).process(phtml)).html;
    }
    //调试
    // console.log(h.html,scriptContainer.allscripts);
    //提取html中的script和普通标签
    return {html:phtml,script:scriptContainer.allscripts,modsign:modsign};
};

window.pack=pack;
window.parser=parser as unknown as Window["parser"];
window.render=render as unknown as Window["render"];
window.posthtml=html;


window.treeapis={ApiSet,ApiReset};

