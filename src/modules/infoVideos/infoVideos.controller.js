const {
  createInfoVideo,
  deleteInfoVideo,
  getInfoVideos,
  getPublicInfoVideos,
  updateInfoVideo,
} = require("./infoVideos.service");
const { created, edited, removed, recordLog } = require("../logs/logs.service");

async function listInfoVideosController(req, res, next) {
  try {
    const result = await getInfoVideos(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function listPublicInfoVideosController(req, res, next) {
  try {
    const result = await getPublicInfoVideos(req.query || {});
    res.status(200).json({ ok: true, ...result });
  } catch (err) {
    next(err);
  }
}

async function createInfoVideoController(req, res, next) {
  try {
    const video = await createInfoVideo(req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: created(`a new informational video: ${video.title}`) });
      }
    } catch {}
    res.status(201).json({ ok: true, video });
  } catch (err) {
    next(err);
  }
}

async function updateInfoVideoController(req, res, next) {
  try {
    const video = await updateInfoVideo(req.params.id, req.body || {});
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: edited(`an informational video: ${video.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, video });
  } catch (err) {
    next(err);
  }
}

async function deleteInfoVideoController(req, res, next) {
  try {
    const video = await deleteInfoVideo(req.params.id);
    try {
      if (req.userId) {
        await recordLog({ userId: req.userId, action: removed(`an informational video: ${video.title}`) });
      }
    } catch {}
    res.status(200).json({ ok: true, video });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listInfoVideosController,
  listPublicInfoVideosController,
  createInfoVideoController,
  updateInfoVideoController,
  deleteInfoVideoController,
};
