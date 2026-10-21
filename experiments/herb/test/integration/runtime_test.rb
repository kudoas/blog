require "test_helper"

class RuntimeTest < ActionDispatch::IntegrationTest
  test "renders an HTML page through the Herb template" do
    get "/"

    assert_response :success
    assert_select "h1", "記事"
    assert_select "button[data-herb-toggle='show_slots_example']"
    assert_select "button[data-herb-toggle='show_slots_example'][aria-expanded='false']"
    assert_select "[data-herb-region]"
    assert_includes response.body, "data-herb-region"
  end

  test "answers the readiness endpoint" do
    get "/up"

    assert_response :success
  end

  test "serves the pinned reactive browser runtime" do
    get "/"
    assert_includes response.body, '"reactionview"'

    runtime_asset = ActionController::Base.helpers.asset_path("reactionview.esm.js")
    get runtime_asset

    assert_response :success
    assert_includes response.media_type, "javascript"
  end
end
