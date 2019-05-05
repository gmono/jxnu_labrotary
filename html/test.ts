class MessageHub
{

}
//jq函数声明
// type JQFunc<TElement=HTMLElement>=(selector_elements_selection_function:
//     JQuery.Selector |
//     JQuery.TypeOrArray<Element> |
//     JQuery |
//     ((this: TElement, index: number, element: TElement) => boolean)
// )=> JQuery<any>;
type JQFunc<TElement=HTMLElement>=(selector?:JQuery.Selector)=>JQuery<TElement>;
type LoadJSFunc=(url:string)=>Promise<any>;
interface PageFuncPars
{
    $:JQFunc;
    window:Window;
    document:Document;
    msghub:MessageHub;
    loadJS:LoadJSFunc;
}
type PageFunc=(pars:PageFuncPars)=>Promise<void>;
//组件化基本程序

async function loadPage(root:HTMLElement,text,script)
{
    root.innerHTML=text;
    //执行代码
    let pagefunc=eval(script) as PageFunc;
    let rootjq=$(root);
    //构造查询函数
    let jqfunc:JQFunc=(...args)=>{
        return rootjq.children(...args);
    };
    //构造只读的window 并代理各种事件
    let onload;
    let pwindow=new Proxy(window,{
        get(target,p,receiver){
            return target[p];
        },
        set(target,p,value,receiver){
            //置换各种事件
            if(p=="onload") onload=value;
            console.log("组件尝试非法写入");
            return true;
        }

    });
    //构造部分只读和代理的document 以下函数都会被在document上调用
    const document_proxy={
        getElementById(this:Document,id){
            return pars.$(`#${id}`)[0];
        },
        createElement(tagname){
            return document.createElement(tagname);
        }
    }
    //调用代理
    const call_proxy=(func:Function)=>(...args)=>{
        return func.apply(document,args);
    }
    //代理文档
    let pdocument=new Proxy(document,{
        get(target,p,receiver){
            //如果p在root节点上有 比如query等 则直接返回
            if(p in root) 
            {
                if(root[p] instanceof Function) return (...args)=>root[p](...args);
                return root[p];
            }
            else if (p in document_proxy)
            {
                if(document_proxy[p] instanceof Function) return call_proxy(document_proxy[p]);
                else return document_proxy[p];
            }
            else return target[p];
        },
        set(target,p,value,receiver){
            console.log("组件尝试非法写入");
            return true;
        }
    });
    let loadfunc=async (url)=>{
        let script=await fetch(url);
        
        if(script.ok)
        {
            let txt=await script.text();
            //执行 这样不知道能不能屏蔽外部作用域
            (()=>{
                let {$,window,document,msghub,loadJS}=pars;
                eval(txt);
            })();
        }
    }
    let pars:PageFuncPars={
        $:jqfunc,
        window:pwindow,
        document:pdocument,
        msghub:new MessageHub(),
        loadJS:loadfunc
    };
    await pagefunc(pars);
    //调用onload
    (()=>{
        let {$,window,document,msghub,loadJS}=pars;
        onload&&onload();
    })();
    
}
async function loadFile(root,url)
{
    let ele=root;
    let res=await fetch(url);
    if(res.ok)
    {
        let text=await res.text();
        //处理
        let {html,script}=await window.pack(text);
        loadPage(ele,html,script);
    }
}
loadFile($("div")[0],"./page1.html");
loadFile($("div")[1],"./page2.html");