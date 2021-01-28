const router = require("express").Router();
const db = require("../myModel");
const md5 = require("../mymd5");
const fd = require("formidable");
const fs = require("fs");
const gm = require("gm");
const sd = require("silly-datetime");
const User = db.User;

// get /users/regist, 跳转到注册页面
router.get("/regist", function(req,res){
  res.render("regist");
})
// get /users/login, 跳转到登录页面
router.get("/login", function(req,res){
  res.render("login");
})

// post /users/check, 判断服务器中有没有该用户名
router.post("/check", function(req,res){
  var username = req.body.username.trim(); // 获取用户名
  if(username==""){
    res.send({status: 1,msg: "用户名不能为空"});
    return ;
  }
  // 查询数据库中有没有username
  User.find({username: username}, function(err,docs){
    if(err){
      console.log(err);
      res.send({status: 2,msg: "网络波动,稍后再试"});
      return ;
    }
    // 查询成功,获取到了docs
    // docs的长度如果为0,则表示没有查到数据
    if(docs.length>0){
      res.send({status: 1, msg: "用户名已存在"});
      return ;
    }
    res.send({status: 0,msg: "用户名可以使用"});
  });
});

// post /users/regist, 注册账号
router.post("/regist", function(req,res){
  var username = req.body.username.trim();
  var password = req.body.password;
  // 判断用户名是否已经存在
  User.find({username: username}, function(err,docs){
    if(err){
      console.log(err);
      res.send({status: 1,msg: "网络波动"});
      return ;
    }
    if(docs.length>0){
      res.send({status: 1, msg: "用户名已经存在"});
      return ;
    }
    // 用户名不存在,可以保存进数据库
    var data = {
      username: username,
      password: md5.md5(password),
      nickname: username // 初始默认昵称就是用户名
    }
    User.create(data, function(err,doc){
      if(err){
        console.log(err);
        res.send({status:2,msg: "注册失败"});
        return ;
      }
      // 保存登录状态
      req.session.username = username;
      res.send({status: 0,msg: "注册成功"});
    });
  })
});

// post /users/login, 登录
router.post("/login", function(req,res){
  var username = req.body.username.trim();
  var password = req.body.password;
  var filter = {
    username: username,
    password: md5.md5(password)
  }
  // 查询
  User.find(filter, function(err,docs){
    if(err){
      console.log(err);
      res.send({status: 1,msg: "网络错误"});
      return ;
    }
    if(docs.length==0){
      res.send({status: 1,msg: "用户名或密码错误"});
      return ;
    }
    // 用户名密码正确,登录成功,保存登录状态
    req.session.username = username;
    res.send({status: 0,msg: "登录成功"});
  })
})

// get /users/center, 跳转到个人中心页面
router.get("/center", function(req,res){
  // center页面中需要展示: 用户头像,用户名,昵称
  // 请求能进入到这里,就说明session中有username
  var username = req.session.username;
  User.find({username: username}, function(err,docs){
    if(err){
      console.log(err);
      res.render("error", {msg: "获取用户信息失败"});
      return ;
    }
    if(docs.length==0){
      res.render("error", {msg: "获取用户信息失败"});
      return ;
    }
    res.render("center", {user: docs[0]});
  });
})

// get /users/logout, 退出登录
router.get("/logout", function(req,res){
  // 登录状态的记录/保存是通过session实现的
  // 所以退出登录即删除登录状态,就是删除session中保存的相关数据
  req.session.destroy(function(err){
    res.redirect("/");
  })
});

// post /users/changeNick, 修改昵称
router.post("/changeNick", function(req,res){
  // 获取参数新昵称
  var nickname = req.body.nickname.trim();
  if(nickname==""){
    res.send({status:1, msg: ""});
    return ;
  }
  // 获取登录的用户名作为修改条件
  var username = req.session.username;
  var filter = {username: username}; // 修改的条件
  var data = {nickname: nickname}; // 修改的数据
  User.updateOne(filter,data, function(err,result){
    if(err){
      console.log(err);
      res.send({status: 1, msg:""});
      return ;
    }
    res.send({status: 0, msg: ""});
  })
});

// post /users/changePwd, 修改密码
router.post("/changePwd", function(req,res){
  // 获取请求参数的新旧密码
  var oldPwd = req.body.oldPwd.trim();
  var newPwd = req.body.newPwd.trim();
  var username = req.session.username;
  var filter = {username: username};
  // 查询旧密码是否正确
  User.find(filter,function(err,docs){
    if(err){ // 查询失败
      console.log(err);
      res.send({status:1,msg:"网络错误"});
      return ;
    }
    // 查询成功
    if(docs.length==0){
      // docs中没有数据
      res.send({status:1,msg:"没有数据"});
      return ;
    }
    // 有数据,判断数据库中的密码与提供的旧密码是否一致
    // docs[0].password 已经被加密过的数据
    // 将oldPwd加密后与数据库中的数据进行判断
    if(md5.md5(oldPwd)!=docs[0].password){ 
      // 旧密码和数据库中的不一样,说明,输入的旧密码是错误的
      res.send({status:1,msg:"旧密码错误"});
      return ;
    }
    // 旧密码正确,修改旧密码
    var data = {password: md5.md5(newPwd)}; // 修改的数据
    User.updateOne(filter,data, function(err,result){
      if(err){
        console.log(err);
        res.send({status:1,msg:"网络错误2"});
        return ;
      }
      // 密码修改成功,删除session,重新登录
      req.session.destroy(function(err){
        res.send({status: 0, msg:"成功"});
      })
    });
  });
});

// get /users/upload, 跳转到上传图片页面
router.get("/upload", function(req,res){
  res.render("upload");
});

// post /users/upload, 处理上传图片
router.post("/upload", function(req,res){
  var username = req.session.username; // 获取登录用户的用户名
  // 创建表单对象
  var form = new fd.IncomingForm();
  form.uploadDir = "./temp"; // 设置上传图片临时保存路径
  // 解析请求
  form.parse(req, function(err,fields,files){
    if(err){
      console.log(err);
      res.render("error",{msg:"上传失败"});
      return ;
    }
    // 获取上传的图片对象
    var pic = files.pic;
    var oldPath = pic.path; // 上传图片临时保存的路径
    var oldName = pic.name; // 上传图片的名称
    var arr = oldName.split(".");
    var ext = arr[arr.length-1]; // 获取后缀名
    var str = sd.format(new Date(),"YYYYMMDDHHmmss"); // 获取当前时间的字符串
    // 设置新名称 username-时间字符串.后缀名
    // zhangsan-20201221131211.jpg
    var newName = username+"-"+str+"."+ext;
    // 新的路径 ./temp/新名称
    var newPath = "./temp/"+newName;
    // 修改名称
    fs.rename(oldPath, newPath, function(err){
      if(err){
        console.log(err);
        res.render("error",{msg:"上传失败2"});
        return ;
      }
      // 修改名称成功,跳转到剪切页面来裁剪头像
      res.render("cut",{img: newName});
    })
  });
});

// get /users/cut, 使用gm剪切图片
router.get("/cut", function(req,res){
  // 获取登录的用户名
  var username = req.session.username;
  // 获取参数
  var w = req.query.w; // 宽度
  var h = req.query.h; // 高度
  var x = req.query.x; // 起点x坐标
  var y = req.query.y; // 起点y坐标
  var img = req.query.img; // 裁剪的图片 /xxx.jpg
  // console.log(w,h,x,y,img);
  // 设置头像的保存路径(用户真正的头像保存在avatars文件夹中)
  // 获取头像后缀名
  var arr = img.split(".");
  var ext = arr[arr.length-1];
  // 头像路径 ./avatars/zhangsan.jpg
  var path = "./avatars/"+username+"."+ext;
  // 使用gm裁剪图片
  gm("./temp"+img).crop(w,h,x,y)
  // 输出新图片路径(用户真正的头像路径)
  .write(path,function(err){
    if(err){
      console.log(err);
      res.send({status:1,msg: "剪切失败"});
      return ;
    }
    // 剪切成功,更新数据库中头像的路径
    var filter = {username: username}; // 修改的条件
    var data = {avatar: username+"."+ext};
    User.updateOne(filter,data,function(err,result){
      if(err){
        console.log(err);
        res.send({status: 1,msg: "修改失败"});
        return;
      }
      res.send({status:0,msg:"修改成功"});
    })
  })
});

module.exports = router;