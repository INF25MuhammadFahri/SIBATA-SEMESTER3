import * as express from "express";
import * as api from "../../api/api.js";
import * as commondata from "../../common_data.js";

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

  if (commondata.dbstatus.success === false) {
    res.status(503).json({
      status: "db isnt availabel",
      is_err: true,
      data: []
    });
    return false;
  }

  return true;
}

/**
 * GET /api/kabupaten_kota
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

  const result = await api.kabupatenKota.getKabupatenKota(pageInd, pageSize, rawSearch);

  if (result.is_err) {
    res.status(500).json({
      status: result.Status || "internal server error",
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

router.get("/", get);

export { router };

