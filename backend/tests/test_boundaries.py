"""Unit tests for boundaries adapter (no DB required)."""

import json

from app.ingest.boundaries import BoundariesRunner


class TestBoundariesRunnerValidate:
    """Tests for BoundariesRunner.validate() method."""

    def test_valid_feature(self):
        runner = BoundariesRunner("dummy.geojson")
        raw = {
            "type": "Feature",
            "properties": {
                "shapeName": "Pekanbaru",
                "shapeGroup": "IDN",
                "shapeType": "ADM2",
                "shapeID": "IDN.14.71",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [101.3, 0.4],
                    [101.5, 0.4],
                    [101.5, 0.6],
                    [101.3, 0.6],
                    [101.3, 0.4],
                ]],
            },
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_valid_multipolygon(self):
        runner = BoundariesRunner("dummy.geojson")
        raw = {
            "type": "Feature",
            "properties": {"shapeName": "Test", "shapeID": "IDN.14.99"},
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [[
                    [[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]],
                ]],
            },
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is True
        assert error is None

    def test_invalid_not_feature(self):
        runner = BoundariesRunner("dummy.geojson")
        raw = {"type": "FeatureCollection", "features": []}
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "Feature" in error

    def test_invalid_geometry_type(self):
        runner = BoundariesRunner("dummy.geojson")
        raw = {
            "type": "Feature",
            "properties": {"shapeName": "Test"},
            "geometry": {"type": "Point", "coordinates": [101.5, 0.5]},
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "geometry type" in error

    def test_missing_name(self):
        runner = BoundariesRunner("dummy.geojson")
        raw = {
            "type": "Feature",
            "properties": {"shapeGroup": "IDN"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]]],
            },
        }
        is_valid, error = runner.validate(raw)
        assert is_valid is False
        assert error is not None and "name" in error


class TestBoundariesRunnerNormalize:
    """Tests for BoundariesRunner.normalize() method."""

    def test_normalize_polygon(self):
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        raw = {
            "type": "Feature",
            "properties": {
                "shapeName": "Pekanbaru",
                "shapeGroup": "IDN",
                "shapeType": "ADM2",
                "shapeID": "IDN.14.71",
                "ADM2_NAME": "Pekanbaru",
                "ADM2_EN": "Pekanbaru",
                "ADM2_PCODE": "IDN.14.71",
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": [[
                    [101.3, 0.4],
                    [101.5, 0.4],
                    [101.5, 0.6],
                    [101.3, 0.6],
                    [101.3, 0.4],
                ]],
            },
        }

        normalized = runner.normalize(raw)

        assert normalized["kode_bps"] == "IDN.14.71"
        assert normalized["name"] == "Pekanbaru"
        assert normalized["level"] == "kabupaten_kota"
        assert normalized["parent_id"] is None  # Set in store
        assert normalized["geom"] is not None
        assert normalized["centroid"] is not None
        assert normalized["properties"]["shapeName"] == "Pekanbaru"
        assert normalized["source_id"] == 1

    def test_normalize_multipolygon(self):
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        raw = {
            "type": "Feature",
            "properties": {"shapeName": "Test", "shapeID": "IDN.14.99"},
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": [[
                    [[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]],
                ]],
            },
        }

        normalized = runner.normalize(raw)
        assert normalized["name"] == "Test"
        assert normalized["kode_bps"] == "IDN.14.99"
        assert normalized["geom"] is not None

    def test_normalize_fallback_name_fields(self):
        """Test that various name property fields are tried."""
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        # Test ADM2_NAME fallback
        raw = {
            "type": "Feature",
            "properties": {"ADM2_NAME": "Fallback Name"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]]],
            },
        }
        normalized = runner.normalize(raw)
        assert normalized["name"] == "Fallback Name"

        # Test name fallback
        raw = {
            "type": "Feature",
            "properties": {"name": "Generic Name"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]]],
            },
        }
        normalized = runner.normalize(raw)
        assert normalized["name"] == "Generic Name"

    def test_kode_bps_extracted_from_shapeID(self):
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        raw = {
            "type": "Feature",
            "properties": {"shapeName": "Test", "shapeID": "IDN.14.71"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]]],
            },
        }
        normalized = runner.normalize(raw)
        assert normalized["kode_bps"] == "IDN.14.71"

    def test_kode_bps_none_when_absent(self):
        """kode_bps should be None when not present, never invented."""
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        raw = {
            "type": "Feature",
            "properties": {"shapeName": "Test"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]]],
            },
        }
        normalized = runner.normalize(raw)
        assert normalized["kode_bps"] is None


class TestBoundariesGeometryConversion:
    """Tests for geometry to WKT conversion."""

    def test_polygon_to_wkt(self):
        runner = BoundariesRunner("dummy.geojson")
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [101.3, 0.4],
                [101.5, 0.4],
                [101.5, 0.6],
                [101.3, 0.6],
                [101.3, 0.4],
            ]],
        }
        wkt = runner._geometry_to_wkt(geometry)
        assert wkt.startswith("POLYGON((")
        assert "101.3 0.4" in wkt
        assert "101.5 0.4" in wkt
        assert wkt.endswith("))")

    def test_multipolygon_to_wkt(self):
        runner = BoundariesRunner("dummy.geojson")
        geometry = {
            "type": "MultiPolygon",
            "coordinates": [[
                [[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]],
            ]],
        }
        wkt = runner._geometry_to_wkt(geometry)
        assert wkt.startswith("MULTIPOLYGON((")
        assert "101.3 0.4" in wkt
        assert wkt.endswith("))")

    def test_centroid_computation(self):
        runner = BoundariesRunner("dummy.geojson")
        geometry = {
            "type": "Polygon",
            "coordinates": [[
                [101.0, 0.0],
                [102.0, 0.0],
                [102.0, 1.0],
                [101.0, 1.0],
                [101.0, 0.0],
            ]],
        }
        centroid = runner._compute_centroid_wkt(geometry)
        assert centroid is not None
        assert centroid.startswith("POINT(")
        # Centroid computation averages all vertices (including closing vertex)
        # (101+102+102+101+101)/5 = 101.4, (0+0+1+1+0)/5 = 0.4
        assert "101.4" in centroid
        assert "0.4" in centroid


class TestBoundariesSyntheticFixture:
    """Tests using the synthetic boundaries fixture."""

    def test_parse_sample_areas(self):
        """Parse the synthetic areas fixture."""
        fixture_path = "tests/fixtures/boundaries/sample_areas.geojson"
        with open(fixture_path) as f:
            data = json.load(f)

        assert data["type"] == "FeatureCollection"
        features = data["features"]
        assert len(features) == 2

        # Check first feature
        feat1 = features[0]
        assert feat1["properties"]["shapeName"] == "Pekanbaru"
        assert feat1["properties"]["shapeID"] == "IDN.14.71"
        assert feat1["geometry"]["type"] == "Polygon"

        # Check second feature
        feat2 = features[1]
        assert feat2["properties"]["shapeName"] == "Dumai"
        assert feat2["properties"]["shapeID"] == "IDN.14.72"

    def test_validate_all_fixture_features(self):
        """Validate all features from synthetic fixture."""
        runner = BoundariesRunner("dummy.geojson")

        with open("tests/fixtures/boundaries/sample_areas.geojson") as f:
            data = json.load(f)

        for feature in data["features"]:
            is_valid, error = runner.validate(feature)
            assert is_valid is True, f"Validation failed for {feature['properties']['shapeName']}: {error}"

    def test_normalize_all_fixture_features(self):
        """Normalize all features from synthetic fixture."""
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        with open("tests/fixtures/boundaries/sample_areas.geojson") as f:
            data = json.load(f)

        for feature in data["features"]:
            normalized = runner.normalize(feature)
            assert normalized["name"] in ("Pekanbaru", "Dumai")
            assert normalized["kode_bps"] in ("IDN.14.71", "IDN.14.72")
            assert normalized["level"] == "kabupaten_kota"
            assert normalized["geom"] is not None
            assert normalized["centroid"] is not None


class TestBoundariesDedupeKey:
    """Tests for dedupe key construction (uq_area: level, name, parent_id)."""

    def test_dedupe_key_components(self):
        """Verify the dedupe key uses level, name, parent_id."""
        runner = BoundariesRunner("dummy.geojson")
        runner._source_id = 1

        raw = {
            "type": "Feature",
            "properties": {"shapeName": "Pekanbaru", "shapeID": "IDN.14.71"},
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[101.3, 0.4], [101.5, 0.4], [101.5, 0.6], [101.3, 0.6], [101.3, 0.4]]],
            },
        }
        normalized = runner.normalize(raw)

        # The dedupe key components
        assert normalized["level"] == "kabupaten_kota"
        assert normalized["name"] == "Pekanbaru"
        # parent_id will be set to Riau provinsi ID in store()

        # Two features with same name but different parent would be different
        # Two features with same name and same parent would conflict (DO UPDATE)
