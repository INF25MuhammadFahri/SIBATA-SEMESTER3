import express from "express";
import sesi from "./internal/sesion.js";
import acc from "./internal/accounts_manager.js";
/**
* @param {express.Request} req 
* @param {express.Response} res 
*/
export async function login(req,res){
  const name=req.body.name;
  const pass=req.body.password;
  if(name==undefined||pass==undefined){
    res.status(400).json({
      status:"unknown format"
    });
    return;
  }
  if(!(await acc.validateUser(name,pass))){
    res.status(401).json({
      status:"incorrect password or name"
    });
    return;
  }
  const userSesi=sesi.createSession(name);
  res.status(200).json({
    status:"ok",
    seesionId:userSesi.sessionId
  });
}
/**
* @param {express.Request} req 
* @param {express.Response} res 
*/
export async function extendSesionEndpoint(req,res){
  const status=sesi.extendSession(req.body.sesionId);
  if(status){
    res.status(200).json({
      status:"ok"
    })
  }else{
    res.status(401).json({
      status:"sesion expired or unregistered"
    })
  }
}
/**
 * @param {express.Request} req
 * @param {express.Response} res
 * @param {express.NextFunction} next
 */
export async function extendSesion(req,res,next){
  const status=sesi.extendSession(req.params.sesion);
  if(status){
    next();
  }else{
    res.status(401).json({
      status:"sesion expired or unregistered"
    })
    return;
  }
}
/**
* @param {express.Request} req 
* @param {express.Response} res 
*/
export async function logout(req,res){
  const sesionId=req.body.sesionId;
  if(sesi.destroySession(sesionId)){
    res.status(200).json({
      status:"ok"
    })
  }else{
    res.status(401).json({
      status:"sesion expired or unregistered"
    })
  }
}




