import * as express from "express";
import * as api from "../../api/api.js";
import * as commondata from "../../common_data.js";
import * as middleware from "../../middleware/middleware.js";

const router = express.Router();

function checkDatabase(res) {
  if (commondata.dbstatus == null) {
    res.status(503).json({
      status: "db isnt initialize yet",
      is_err: true,
      data: []
    });
    return false;
  }

  if (commondata.dbstatus.valid === false || commondata.dbstatus.success === false) {
    res.status(503).json({
      status: "db isnt availabel",
      is_err: true,
      data: []
    });
    return false;
  }

  return true;
}

function isDataObject(data) {
  return data !== null && typeof data === "object" && !Array.isArray(data);
}

function isArrayOfString(data) {
  return Array.isArray(data) && data.every(item => typeof item === "string");
}

/**
 * GET /api/kandidat_lokasi
 */
async function get(req, res) {
  if (!checkDatabase(res)) return;

  const rawPage = req.query.page;
  const rawSize = req.query.size;
  const rawSearch = req.query.search;

  const pageInd = rawPage === undefined ? 0 : Number(rawPage);
  const pageSize = rawSize === undefined ? null : Number(rawSize);

  if (
    !Number.isSafeInteger(pageInd) ||
    pageInd < 0 ||
    (pageSize !== null && (!Number.isSafeInteger(pageSize) || pageSize < 0))
  ) {
    res.status(400).json({
      status: "bad pagination",
      is_err: true,
      data: []
    });
    return;
  }

  const result = await api.kandidatLokasi.getKandidatLokasi(pageInd, pageSize, rawSearch);

  if (result.is_err) {
    res.status(500).json({
      status: result.Status || "internal server error",
      is_err: true,
      data: []
    });
    return;
  }

  if (!Array.isArray(result.data)) {
    res.status(500).json({
      status: "invalid API response",
      is_err: true,
      data: []
    });
    return;
  }

  if (result.data.length === 0) {
    res.status(404).json({
      status: "not found",
      is_err: false,
      data: []
    });
    return;
  }

  res.status(200).json({
    status: "ok",
    is_err: false,
    data: result.data
  });
}

/**
 * POST /api/kandidat_lokasi
 */
async function post(req, res) {
  if (!isDataObject(req.body)) {
    res.status(400).json({
      status: "bad format",
      is_err: true,
      data: []
    });
    return;
  }

  if (!checkDatabase(res)) return;

  const result = await api.kandidatLokasi.postKandidatLokasi(req.body);

  if (result.is_err) {
    res.status(500).json({
      status: result.Status || "internal server error",
      is_err: true,
      data: []
    });
    return;
  }

  if (result.data.length > 0) {
    res.status(409).json({
      status: "conflict",
      is_err: false,
      data: result.data
    });
    return;
  }

  res.status(201).json({
    status: "ok",
    is_err: false,
    data: []
  });
}

/**
 * PUT /api/kandidat_lokasi
 */
async function put(req, res) {
  if (!isDataObject(req.body)) {
    res.status(400).json({
      status: "bad format",
      is_err: true,
      data: []
    });
    return;
  }

  if (!checkDatabase(res)) return;

  const result = await api.kandidatLokasi.putKandidatLokasi(req.body);

  if (result.is_err) {
    res.status(500).json({
      status: result.Status || "internal server error",
      is_err: true,
      data: []
    });
    return;
  }

  if (result.data.length > 0) {
    res.status(404).json({
      status: "not found",
      is_err: false,
      data: result.data
    });
    return;
  }

  res.status(200).json({
    status: "ok",
    is_err: false,
    data: []
  });
}

/**
 * DELETE /api/kandidat_lokasi
 */
async function del(req, res) {
  if (!isArrayOfString(req.body)) {
    res.status(400).json({
      status: "bad format",
      is_err: true,
      data: []
    });
    return;
  }

  if (!checkDatabase(res)) return;

  const result = await api.kandidatLokasi.delKandidatLokasi(req.body);

  if (result.is_err) {
    res.status(500).json({
      status: result.Status || "internal server error",
      is_err: true,
      data: []
    });
    return;
  }

  if (result.data.length > 0) {
    res.status(404).json({
      status: "not found",
      is_err: false,
      data: result.data
    });
    return;
  }

  res.status(200).json({
    status: "ok",
    is_err: false,
    data: []
  });
}

router.get("/", get);
router.post("/", middleware.extendSesion, post);
router.put("/", middleware.extendSesion, put);
router.delete("/", middleware.extendSesion, del);

export { router };
