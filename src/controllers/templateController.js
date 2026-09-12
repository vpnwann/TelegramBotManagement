import { query } from "../config/db.js";

// GET /api/templates?search=welcome
export async function listTemplates(req, res) {
  try {
    const { search } = req.query;

    const params = [];
    let whereClause = "";

    if (search) {
      params.push(`%${search}%`);
      whereClause = `WHERE name ILIKE $1 OR text ILIKE $1`;
    }

    const result = await query(
      `SELECT * FROM templates ${whereClause} ORDER BY created_at DESC`,
      params
    );

    return res.success(result.rows);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// POST /api/templates
export async function createTemplate(req, res) {
  try {
    const { name, text, parseMode } = req.body;

    if (!name || !text) {
      return res.fail("name and text are required", 422);
    }

    const result = await query(
      `INSERT INTO templates (name, text, parse_mode)
       VALUES ($1, $2, COALESCE($3, 'HTML'))
       RETURNING *`,
      [name, text, parseMode]
    );

    return res.success(result.rows[0], 201);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// GET /api/templates/:id
export async function getTemplate(req, res) {
  try {
    const { id } = req.params;
    const result = await query(`SELECT * FROM templates WHERE id = $1`, [id]);

    if (result.rows.length === 0) {
      return res.fail("Template not found", 404);
    }

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// PUT /api/templates/:id
export async function updateTemplate(req, res) {
  try {
    const { id } = req.params;
    const { name, text, parseMode } = req.body;

    const existing = await query(`SELECT * FROM templates WHERE id = $1`, [
      id,
    ]);

    if (existing.rows.length === 0) {
      return res.fail("Template not found", 404);
    }

    const current = existing.rows[0];

    const result = await query(
      `UPDATE templates
       SET name = $1, text = $2, parse_mode = $3, updated_at = NOW()
       WHERE id = $4
       RETURNING *`,
      [
        name ?? current.name,
        text ?? current.text,
        parseMode ?? current.parse_mode,
        id,
      ]
    );

    return res.success(result.rows[0]);
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

// DELETE /api/templates/:id
export async function deleteTemplate(req, res) {
  try {
    const { id } = req.params;
    const result = await query(
      `DELETE FROM templates WHERE id = $1 RETURNING id`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.fail("Template not found", 404);
    }

    return res.success({ id: result.rows[0].id, deleted: true });
  } catch (err) {
    return res.fail(err.message, 500);
  }
}

export default {
  listTemplates,
  createTemplate,
  getTemplate,
  updateTemplate,
  deleteTemplate,
};
