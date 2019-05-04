const posthtml=require("posthtml");
const fs=require("fs");

async function main(){
    let h=await posthtml().use((tree)=>{
        console.log(tree);
    }).process("<div></div>");
    console.log(posthtml,h.html);
};
main();