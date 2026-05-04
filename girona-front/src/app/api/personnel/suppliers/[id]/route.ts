import { NextResponse } from "next/server";

import { errorToJson, getBackendBaseUrl, safeJson, toAbsoluteUrl } from "../../_utils";

type SupplierUpdateBody = {
  name?: string;
  phone?: string | null;
  gender?: string;
  is_active?: boolean;
  tax_regime?: "common" | "natural";
  income_tax_declarant?: boolean;
  default_withholding_operation?: "purchase" | "service";
  default_withholding_percent?: number | null;
  ingredient_product_ids?: number[];
};

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
  const params = await context.params;
  const id = params.id;

  const body = (await request.json().catch(() => null)) as SupplierUpdateBody | null;

  if (!body) {
    return NextResponse.json({ message: "Body inválido (JSON requerido)" }, { status: 400 });
  }

  const backendBaseUrl = getBackendBaseUrl();
  const url = toAbsoluteUrl(backendBaseUrl, `/personnel/suppliers/${id}`);

  const payloadToSend: Record<string, unknown> = {};
  if (body.name !== undefined) payloadToSend.name = body.name;
  if (body.phone !== undefined) payloadToSend.phone = body.phone;
  if (body.gender !== undefined) payloadToSend.gender = body.gender;
  if (body.is_active !== undefined) payloadToSend.is_active = body.is_active;
  if (body.ingredient_product_ids !== undefined) {
    payloadToSend.ingredient_product_ids = Array.isArray(body.ingredient_product_ids)
      ? body.ingredient_product_ids.filter((id) => typeof id === "number" && Number.isFinite(id))
      : [];
  }
  if (body.tax_regime !== undefined) {
    payloadToSend.tax_regime = body.tax_regime === "natural" ? "natural" : "common";
  }
  if (body.income_tax_declarant !== undefined) {
    payloadToSend.income_tax_declarant = !!body.income_tax_declarant;
  }
  if (body.default_withholding_operation !== undefined) {
    payloadToSend.default_withholding_operation =
      body.default_withholding_operation === "service" ? "service" : "purchase";
  }
  if (body.default_withholding_percent !== undefined) {
    if (body.default_withholding_percent === null) {
      payloadToSend.default_withholding_percent = null;
    } else {
      const n = Number(body.default_withholding_percent);
      if (!Number.isFinite(n) || n < 0 || n > 100) {
        return NextResponse.json(
          { message: "Porcentaje de retención inválido (0–100 o vacío como null)" },
          { status: 400 },
        );
      }
      payloadToSend.default_withholding_percent = n;
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payloadToSend),
    });
  } catch (error) {
    return NextResponse.json(
      {
        message:
          "No se pudo conectar con el backend para editar el proveedor. Verifica que Uvicorn esté corriendo y que `BACKEND_URL` sea accesible desde el servidor de Next.js.",
        backendUrl: backendBaseUrl,
        triedUrl: url,
        error: errorToJson(error),
      },
      { status: 502 },
    );
  }

  const payload = await safeJson(response);
  if (!response.ok) {
    const message =
      (typeof (payload as any)?.detail === "string" && (payload as any).detail) ||
      (typeof (payload as any)?.message === "string" && (payload as any).message) ||
      "No se pudo editar el proveedor";

    return NextResponse.json(
      { message, error: payload, backendUrl: backendBaseUrl, triedUrl: url },
      { status: response.status || 400 },
    );
  }

  return NextResponse.json(payload);
}
