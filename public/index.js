/**
 * index页的js文件
 */
let a = 1;
d3.select("svg").style("height", "1000px")
    .style("width", "1000px");
d3.timer((e) => {
    d3.selectAll($("circle").toArray()).transition().duration(200).attr("r", a++);
    d3.select("svg").transition().duration(200).style("background-color", `rgb(${a},${a * 1.2},${a * 1.3})`);
});
//# sourceMappingURL=index.js.map