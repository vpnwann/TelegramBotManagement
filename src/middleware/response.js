/**
 * Attaches res.success() and res.fail() helpers to every response
 * so controllers can respond in a consistent format.
 */
export function responseHelpers(req, res, next) {
  res.success = (data = {}, statusCode = 200) => {
    return res.status(statusCode).json({ success: true, data });
  };

  res.fail = (error = "Something went wrong", statusCode = 400) => {
    const message = error instanceof Error ? error.message : error;
    return res.status(statusCode).json({ success: false, error: message });
  };

  next();
}

export default responseHelpers;
