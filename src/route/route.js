import express from "express";
import * as api from "../api/api.js";
export * as data_sawah from "./internal/data_sawah.js";
export * as wilayah from "./internal/wilayah.js";
export * as infrastruktur from "./internal/infrastruktur.js";
export * as kandidat_lokasi from "./internal/kandidat_lokasi.js";
export * as status_lahan from "./internal/status_lahan.js";
export * as pemilik from "./internal/pemilik.js";
export * as kabupaten_kota from "./internal/kabupaten_kota.js";
export * as sawah_infrastruktur from "./internal/sawah_infrastruktur.js";
/**
 * Endpoint gabungan (joined data) untuk kebutuhan visualisasi dashboard frontend
 */
export async function getJoined(req, res) {
  try {
    const data = await api.joinAll();
    res.status(200).json({
      status: "ok",
      is_err: false,
      data
    });
  } catch (err) {
    res.status(500).json({
      status: err.message || "Gagal mengambil data gabungan",
      is_err: true,
      data: []
    });
  }
}
export async function getDbStatus(req,res){
  res.status(200).json(api.databaseStatus());
}
// Test endpoints
export async function get(req, res) {
  res.status(200).json({
    status: "ok",
    data: [{ id: "12", test: "success" }]
  });
}

export async function post(req, res) {
  res.status(200).json({
    status: "ok",
    data: []
  });
}

export async function put(req, res) {
  res.status(200).json({
    status: "ok",
    data: []
  });
}

export async function del(req, res) {
  res.status(200).json({
    status: "ok",
    data: []
  });
}
