from services.merge_field_labels_service import MERGE_FIELD_KEYS, merged_label_map


def test_merged_label_map_defaults():
    m = merged_label_map(global_patch={}, workspace_patch=None)
    assert set(m.keys()) == set(MERGE_FIELD_KEYS)
    assert m["problem_seen"]["label"] == "Problem seen"
    assert "context only" in (m["problem_seen"]["context_intro"] or "")


def test_workspace_override_over_global():
    g = {"company": {"label": "Org"}}
    w = {"company": {"label": "Account"}}
    m = merged_label_map(global_patch=g, workspace_patch=w)
    assert m["company"]["label"] == "Account"
    assert m["solution"]["label"] == "Solution"
