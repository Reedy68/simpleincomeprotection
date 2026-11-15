"undefined" == typeof vmjQuery && ("undefined" != typeof jQuery ? window.vmjQuery = jQuery : console.log("jQuery is required for Data8 Ajax Address Validation"));
"undefined" == typeof data8 && (window.data8 = function() {})

~function($) {

	data8.VMPostCodeLookUp = function(fields, options){
		this.form = null;
		this.fields = fields;
		this.options = options;
		this.url_base = 'https://webservices.data-8.co.uk';
		this.key = options.ajaxKey;
		this.click_button_notice = 'Please click the Find Address button';
		this.find_button_label = 'Find Address';
		this.find_button_loading = 'Loading....';
		this.allow_manually = 0;
		this.manually_button_label = 'Enter Address Manually';
		this.manually = false;

		this.init = function(){

			//init status
			this.initStatus();

			//element mark
			this.elementMark();

			//build structure
			this.buildStructure();

			//bind events
			this.bindEvents();

		}

		this.initStatus = function(){
			this.finded = false;
			this.selected = false;
			this.address_select_type = 'select';
		}

		this.elementMark = function(){

			this.postcode_input = $('#' + this.fields.postcode);
			this.address_select = $('#' + this.fields.address);

			this.form = this.postcode_input.parents('.vmform');

			this.postcode_key = this.postcode_input.attr('name');
			this.address_key = this.address_select.attr('name');

			this.postcode_input.data('validate_object', this);
			this.address_select.data('validate_object', this);

			if(this.postcode_input.data('find-button-text')){
				this.find_button_label = this.postcode_input.data('find-button-text');
			}

			this.postcode_field = this.postcode_input.parents('.vmform-field');
			this.address_field = this.address_select.parents('.vmform-field');

			this.address_field.addClass('vmform-rule-hidden');
			this.form.trigger('update_rows');

			if(this.address_select.is('select')){
				this.address_select_type = 'select';
			}else{
				this.address_select_type = 'scroll';
			}

			if(this.address_select_type == 'scroll'){
				this.scroll_ul = this.address_field.find('.vmform-address-scroll-ul');
			}

			if (this.postcode_input.hasClass('vmform-apply-address-lookup-allow-manually')){
				this.allow_manually = 1;
				this.manually_button_label = this.postcode_input.data('address-lookup-manually-text');
			}

			this.set_city_field = this.postcode_input.data('address-set-city-field');
			if(this.set_city_field){
				this.city_input = this.postcode_field.parents('form').find('[name='+this.set_city_field+']');
				this.city_field = this.city_input.parents('.vmform-field');

				this.city_field.addClass('vmform-rule-hidden');
				this.form.trigger('update_rows');
			}

		}

		this.buildStructure = function(){

			//add new control
			this.postcode_new_control = $('<div class="vmform-control vmform-address-control"></div>');
			this.address_new_control = $('<div class="vmform-control vmform-address-control"></div>');

			//add find button
			this.postcode_new_control.append('<div class="vmform-address-find"><a class="vmform-address-find-button">'+this.find_button_label+'</a></div>');

			//manually button
			if(this.allow_manually){
				this.postcode_new_control.append('<div class="vmform-address-manually"><a class="vmform-address-manually-link">' + this.manually_button_label + '</a></div>');
				this.postcode_new_control.append('<div class="vmform-address-manually"><a class="vmform-address-manually-link-cancel">Back to postcode search</a></div>');
			}

			//add 2nd find button
			this.address_new_control.append('<div class="vmform-address-find"><a class="vmform-address-find-button">'+this.find_button_label+'</a></div>');

			//add address box
			this.address_new_control.append('<div class="vmform-address-box"></div>')

			//add change link
			this.address_new_control.append('<div class="vmform-address-change"><a class="vmform-address-change-link">Change address</a></div>')

			//append
			this.postcode_field.append(this.postcode_new_control);
			this.address_field.append(this.address_new_control);

			this.find_button = this.postcode_field.find('.vmform-address-find-button');
			this.find_button2 = this.address_field.find('.vmform-address-find-button');

			this.address_box = this.address_field.find('.vmform-address-box');
			this.address_box.hide();

			this.manually_button = this.postcode_field.find('.vmform-address-manually-link');
			this.manually_cancel_button = this.postcode_field.find('.vmform-address-manually-link-cancel');
			this.manually_cancel_button.hide();

			this.change_link_box = this.address_field.find('.vmform-address-change');
			this.change_link = this.address_field.find('.vmform-address-change-link');
			this.change_link_box.hide();

			this.form.trigger('set-height')
		}

		this.bindEvents = function(){

			var me = this;

			this.postcode_input.keydown(function(evt){
				if(evt.key == 'Enter'){
					me.find_button.trigger('click');
					return false;
				}
			})

			var find_button_action = function(){

				var postcode = me.postcode_input.val();

				if(postcode == '' && !me.postcode_field.find('.vmform-error').is(':visible')){
					me.postcode_field.removeClass('vmform-untouched');
					me.postcode_input.trigger('blur', [true]);
				}else{
					me.findAddresses(postcode);
				}

			};
			//find address
			this.find_button.click(find_button_action);
			this.find_button2.click(find_button_action);

			//select address
			if(this.address_select_type == 'select'){
				this.address_select.change(function(){

					//check empty
					var address_val = me.address_select.val();
					if(address_val == ''){
						return;
					}

					var postcode_val = me.address_select.find('option:selected').data('postcode');
					var city_val = me.address_select.find('option:selected').data('city');

					me.selectAddress(postcode_val, address_val, city_val);
				});
			}else{
				this.scroll_ul.on('click', 'li', function(){
					var li = $(this);

					var postcode_val = li.data('postcode');
					var address_val = li.data('address');
					var city_val = li.data('city');

					if(address_val == ''){
						return;
					}

					me.selectAddress(postcode_val, address_val, city_val);
				});
			}


			this.manually_button.click(function(){

				me.find_button.hide();
				me.find_button2.hide();

				me.address_field.removeClass('vmform-rule-hidden');
				
				if(me.city_field){
					me.city_field.removeClass('vmform-rule-hidden');
				}

				var label_ele = me.postcode_field.find('.vmform-label-text');
				label_ele.text(label_ele.data('vm-old-label'));
				me.postcode_input.attr('placeholder', me.postcode_input.data('vm-old-placeholder'));
				var sublabel_ele = me.postcode_field.find('.vmform-sublabel-text');
				sublabel_ele.text(sublabel_ele.data('vm-old-sublabel'));

				if (me.address_select_type == 'scroll') {
					me.scroll_ul.parent().hide();
					me.address_select.attr('type', 'text');
				}else{
					me.address_select.prop('disabled', true);

					if(me.address_field.find('.vmform-address-input-manually').length == 0){
						var new_address_input = $('<input type="text">');
						new_address_input.attr('class', me.address_select.attr('class'));
						new_address_input.attr('name', me.address_select.attr('name'));
						new_address_input.removeClass('vmform-select').addClass('vmform-input').addClass('vmform-address-input-manually')
						new_address_input.removeClass('with-placeholder');
						me.address_select.hide();

						me.address_select.after(new_address_input);
					}
				}

				var label_ele = me.address_field.find('.vmform-label-text');
				label_ele.text(label_ele.data('vm-old-label'));
				me.address_field.find('input').attr('placeholder', me.address_field.find('select').data('vm-old-placeholder'));
				var sublabel_ele = me.address_field.find('.vmform-sublabel-text');
				sublabel_ele.text(sublabel_ele.data('vm-old-sublabel'));

				me.manually_button.hide();
				me.manually_cancel_button.show();

				me.postcode_input.trigger('clean');
				me.form.find('.vmform-message').hide();
				me.form.trigger('update_rows');
				me.form.trigger('set-height');

				me.manually = true;
			})

			this.manually_cancel_button.click(function(){
				me.find_button.show();

				me.address_field.addClass('vmform-rule-hidden');

				if(me.city_field){
					me.city_field.addClass('vmform-rule-hidden');
				}

				var label_ele = me.postcode_field.find('.vmform-label-text');
				label_ele.text(label_ele.data('vm-label'));
				me.postcode_input.attr('placeholder', me.postcode_input.data('vm-placeholder'));
				var sublabel_ele = me.postcode_field.find('.vmform-sublabel-text');
				sublabel_ele.text(sublabel_ele.data('vm-sublabel'));

				if (me.address_select_type == 'scroll') {
					me.scroll_ul.parent().show();
					me.address_select.attr('type', 'hidden');
				} else {
					me.address_select.prop('disabled', false);

					me.address_field.find('.vmform-address-input-manually').remove();
					me.address_select.show();
				}

				var label_ele = me.address_field.find('.vmform-label-text');
				label_ele.text(label_ele.data('vm-label'));
				me.address_field.find('input').attr('placeholder', me.address_field.find('select').data('vm-placeholder'));
				var sublabel_ele = me.address_field.find('.vmform-sublabel-text');
				sublabel_ele.text(sublabel_ele.data('vm-sublabel'));

				me.manually_button.show();
				me.manually_cancel_button.hide();

				me.postcode_input.trigger('clean');
				me.form.find('.vmform-message').hide();
				me.form.trigger('update_rows');
				me.form.trigger('set-height');

				me.manually = false;
			})

			this.change_link.click(function(){

				//hide address box
				me.address_box.hide();
				me.change_link_box.hide();

				//show postcode field
				me.postcode_field.removeClass('vmform-rule-hidden');

				//show address field
				me.address_field.find('.vmform-control').show();

				//set address value
				me.address_select.val('');
				me.address_select.trigger('clean');

				//set postcode value
				me.postcode_input.val('');
				me.postcode_input.trigger('clean');
				me.postcode_input.focus();
				me.find_button.show();

				if(this.city_input){
					this.city_input.val('')
				}

				//hide address field
				me.address_field.addClass('vmform-rule-hidden');
				me.form.trigger('update_rows');

				//set status
				me.finded = false;
				me.selected = false;

			})
		}

		this.findAddresses = function(postcode){

			var me = this;

			this.address_field.addClass('vmform-rule-hidden');
			this.address_select.empty();
			this.postcode_input.trigger('clean');
			this.finded = false;
			this.find_button.text(this.find_button_loading);

			$.ajax({
				method: 'post',
				beforeSend: function() {},
				url: this.url_base + '/AddressCapture/GetFullAddress.json?key=' + this.key,
				data: JSON.stringify({
					postcode: postcode,
					licence: "WebClickFull",
					options: {
						ApplicationName: "address.js",
						FixTownCounty: false,
						Formatter: "DefaultFormatter",
						IncludeMR: false,
						IncludeNYB: false,
						MaxLines: 1
					}
				}),
				success: function(data){
					if(data.Status.Success){
						var results = data.Results;

						if(results.length == 0){
							var error_message = 'No address found';
							me.postcode_field.find('.vmform-error-text').html(error_message);
							me.postcode_field.find('.vmform-error').show();
							me.finded = false;
							me.selected = false;
							me.find_button.text(me.find_button_label);

							me.form.trigger('set-height');
						}else{

							if(me.address_select_type == 'select'){
								var placeholder = me.address_select.data('placeholder');
								if(!placeholder) placeholder = 'Please select';
								var options = results.map(function(result){
									var addressline = result.Address.Lines[0];
									if(me.city_input){
										var city_string_len = (', ' + result.RawAddress.Locality).length;
										if(addressline.slice(-1 * city_string_len) === ', ' + result.RawAddress.Locality){
											addressline = addressline.slice(0, -1 * city_string_len);
										}
									}
									return '<option data-city="'+ result.RawAddress.Locality +'" data-postcode="'+ result.Address.Lines[1] +'" value="' +addressline+ '">' +result.Address.Lines[0]+ '</option>';
								})
								me.address_select.append('<option value="">' + placeholder + '</option>');
								me.address_select.append(options);
							}else{
								var options = results.map(function(result){
									var addressline = result.Address.Lines[0];
									if(me.city_input){
										var city_string_len = (', ' + result.RawAddress.Locality).length;
										if(addressline.slice(-1 * city_string_len) === ', ' + result.RawAddress.Locality){
											addressline = addressline.slice(0, -1 * city_string_len);
										}
									}
									return '<li data-city="'+ result.RawAddress.Locality +'" data-postcode="'+ result.Address.Lines[1] +'" data-address="' +addressline+ '">' +result.Address.Lines[0]+ '</li>';
								})
								me.scroll_ul.append(options);
							}

							me.finded = true;
							me.selected = false;
							me.find_button.text(me.find_button_label);
							me.find_button.hide();
							me.find_button2.show();
							me.address_field.removeClass('vmform-rule-hidden')
							me.address_box.hide();

							me.form.trigger('update_rows');
							me.form.trigger('set-height');
						}

					}else{
						var error_message = data.Status.ErrorMessage;
						me.postcode_field.find('.vmform-error-text').html(error_message);
						me.postcode_field.find('.vmform-error').show();
						me.finded = false;
						me.selected = false;
						me.find_button.text(me.find_button_label);

						me.form.trigger('update_rows');
						me.form.trigger('set-height');
					}
				},
				dataType: 'json'
			})
		}

		this.selectAddress = function(postcode_val, address_val, city_val){
			this.postcode_input.val(postcode_val);

			if(this.address_select_type == 'scroll'){
				this.address_select.val(address_val);
			}

			var address_html = address_val + '<br/>' + postcode_val;
			this.address_box.html(address_html);

			if(this.city_input && city_val){
				this.city_input.val(city_val);
			}

			this.postcode_field.addClass('vmform-rule-hidden');
			this.address_field.find('.vmform-control:first').hide();
			this.find_button2.hide();

			this.address_box.show();
			this.change_link_box.show();
			this.selected = true;

			this.form.trigger('update_rows');
			this.form.trigger('set-height');
		}

		this.validate = function(status){

			var me = this;

			//bind address validation error to postcode
			if(!this.finded && !this.manually){

				if(status.status == 'error' && typeof status.field_errors[this.address_key] != 'undefined'){
					return {
						status: 'error',
						error_code: 'data_incomplete',
						message: 'Please choose an address from the options',
						field_errors: {
							[this.postcode_key]: me.click_button_notice,
						},
						error_source: 'address_lookup',
					}
				}
			}

			return status;

		}

		this.init();
	}

}(vmjQuery)
