var express = require('express');
var router = express.Router();

// request 模块就是进行网页的爬取模块
let request = require("request");
// 解决抓取的内容乱码问题
let iconv = require("iconv-lite");
// cheerio模块就是进行对当前的页面能用jq进行操作
let cheerio = require("cheerio");

var Category = require('../models/Category');
var Content = require('../models/Content');

var data;

/*
* 处理通用的数据
* */
router.use(function (req, res, next) {
    data = {
        userInfo: req.userInfo,
        categories: []
    } 
    // 新浪博客抓取
    request.get({url:"https://s.weibo.com/top/summary?Refer=top_hot&topnav=1&wvr=6",encoding:null},(err,response,body)=>{
        if(!err&&response.statusCode==200){          
            let newbody = iconv.decode(body,"utf8");
            let $ = cheerio.load(newbody);
            let tr = $("tbody").find("tr");
            let nhot_arr = [];
            let nsrc_arr = [];   
            let hots = [];

            for(let i=0;i<tr.find("a").length;i++){
                nhot_arr.push(unescape(tr.find("a").eq(i).html().replace(/&#x/g,'%u').replace(/;/g,'')));
                nsrc_arr.push(tr.find("a").eq(i).attr("href")); 
            }
            for(let i=0;i<tr.find("span").length;i++){
                hots.push(tr.find("span").eq(i).html());
            }

            data.hot1 = unescape(tr.find("a").eq(0).html().replace(/&#x/g,'%u').replace(/;/g,''))
            // unescape将以$#开头的编码转化为正常汉字
            // console.log(unescape($("tbody tr td a").html().replace(/&#x/g,'%u').replace(/;/g,'')));
            
            data.hotArr = nhot_arr.slice(1,21);
            data.hots = hots.slice(0,20);
            data.hotSrc = nsrc_arr;
            Category.find().then(function(categories) {
                data.categories = categories;      
                next();
            });

            router.get('/', function(req, res, next) {
                data.category = req.query.category || '';
                data.count = 0;
                data.page = Number(req.query.page || 1);
                data.limit = 10;
                data.pages = 0;
                var where = {};
                if (data.category) {
                    where.category = data.category
                }

                Content.where(where).count().then(function(count) {

                    data.count = count;
                    //计算总页数
                    data.pages = Math.ceil(data.count / data.limit);
                    //取值不能超过pages
                    data.page = Math.min( data.page, data.pages );
                    //取值不能小于1
                    data.page = Math.max( data.page, 1 );

                    var skip = (data.page - 1) * data.limit;

                    return Content.where(where).find().limit(data.limit).skip(skip).populate(['category', 'user']).sort({
                        addTime: -1
                    });

                }).then(function(contents) {
                    data.contents = contents;
                    res.render('main/index', data);
                })
            });
            router.get('/view', function (req, res){

                var contentId = req.query.contentid || '';

                Content.findOne({
                    _id: contentId
                }).then(function (content) {
                    data.content = content;
                    content.views++;
                    content.save();
                    res.render('main/view', data);
                });

            });
            router.get("/content/add",function(req,res){
                // console.log("aa");
                Category.find().sort({_id: -1}).then(function(categories) {
                    res.render('main/content_add', {
                        userInfo: req.userInfo,
                        categories: categories
                    })
                });

            })
            router.get("/content_error",(req,res)=>{
                res.render("main/content_error",{
                    userInfo: req.userInfo,
                    message: '标题内容或分类不能为空'
                })
            })
            router.post("/doAdd",(req,res)=>{
                 if(req.body.title == '') {
                    res.json({"result":-1});
                    return;
                }

                //保存数据到数据库
                new Content({
                    category: req.body.category,
                    title: req.body.title,
                    user: req.userInfo._id.toString(),
                    description: req.body.description,
                    content: req.body.content,
                    addTime:new Date()
                }).save().then(function(rs) {
                    res.json({"result":1});
                    //res.redirect('/')
                })
            });

        }      
    }) 
                
});

          

module.exports = router;