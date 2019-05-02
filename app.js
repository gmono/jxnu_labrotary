const posthtml=require("posthtml");
async function main(){
    let h=await posthtml().use((tree)=>{
        console.log(tree);
    }).process("<div></div>");
    console.log(posthtml,h.html);
};
main();