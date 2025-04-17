/**
 * Controller for query API endpoints.
 * Handles request validation, delegates to data retrieval service,
 * manages response formatting and error handling.
 */

import { NextResponse } from "next/server";
import { formatBadRequestResponse, formatErrorResponse } from "../../../utils/shared/errorHandler";
import DataRetrievalService from "../services/dataRetrievalService";

const dataRetrievalService = new DataRetrievalService();

export async function postHandler(request) {
  try {
    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return formatBadRequestResponse("Missing or invalid 'query' field");
    }

    const result = await dataRetrievalService.processQueryWithData(query, "all-sector");

    return NextResponse.json(result);
  } catch (error) {
    return formatErrorResponse(error);
  }
}
